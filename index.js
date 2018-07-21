'use strict'

const util = require('util')
const parseUrl = require('url').parse
const zlib = require('zlib')
const Writable = require('readable-stream').Writable
const pump = require('pump')
const ndjson = require('ndjson')
const safeStringify = require('fast-safe-stringify')
const streamToBuffer = require('fast-stream-to-buffer')
const StreamChopper = require('stream-chopper')
const pkg = require('./package')

const flush = Symbol('flush')

module.exports = Client

// All sockets on the agent are unreffed when they are created. This means that
// when those are the only handles left, the `beforeExit` event will be
// emitted. By listening for this we can make sure to end the requests properly
// before exiting. This way we don't keep the process running until the `time`
// timeout happens.
const clients = []
process.once('beforeExit', function () {
  clients.forEach(function (client) {
    if (!client) return // clients remove them selfs from the array when they end
    client.end()
  })
})

util.inherits(Client, Writable)

function Client (opts) {
  if (!(this instanceof Client)) return new Client(opts)

  opts = normalizeOptions(opts)

  Writable.call(this, opts)

  const errorproxy = (err) => {
    // Emit as warning if the error is recoverable. If we emitted it as an
    // error, the Client object would be destroyed
    if (this._destroyed === false) this.emit('warning', err)
  }

  this._active = false
  this._destroyed = false
  this._onflushed = null
  this._transport = require(opts.serverUrl.protocol.slice(0, -1)) // 'http:' => 'http'
  this._agent = new this._transport.Agent(opts)
  this._stream = ndjson.serialize()
  this._chopper = new StreamChopper(opts)
    .on('stream', onStream(opts, this, errorproxy))

  this._stream.on('error', (err) => {
    if (this._destroyed === false) this.emit('error', err)
  })
  this._chopper.on('error', errorproxy)

  pump(this._stream, this._chopper)

  this._index = clients.length
  clients.push(this)
}

// re-ref the open socket handles
Client.prototype._ref = function () {
  Object.keys(this._agent.sockets).forEach(remote => {
    this._agent.sockets[remote].forEach(function (socket) {
      socket.ref()
    })
  })
}

Client.prototype._write = function (obj, enc, cb) {
  if (this._destroyed) {
    this.emit('error', new Error('write called on destroyed Elastic APM client'))
    cb()
  } else if (obj === flush) {
    if (this._active) {
      this._onflushed = cb
      this._chopper.chop()
    } else {
      this._chopper.chop(cb)
    }
  } else {
    this._stream.write(obj, cb)
  }
}

Client.prototype.sendSpan = function (span, cb) {
  return this.write({span}, cb)
}

Client.prototype.sendTransaction = function (transaction, cb) {
  return this.write({transaction}, cb)
}

Client.prototype.sendError = function (error, cb) {
  return this.write({error}, cb)
}

Client.prototype.flush = function (cb) {
  if (this._destroyed) {
    this.emit('error', new Error('flush called on destroyed Elastic APM client'))
    if (cb) process.nextTick(cb)
    return
  }

  // Write the special "flush" signal. We do this so that the order of writes
  // and flushes are kept. If we where to just flush the client right here, the
  // internal Writable buffer might still contain data that hasn't yet been
  // given to the _write function.
  return this.write(flush, cb)
}

Client.prototype._final = function (cb) {
  if (this._destroyed) {
    this.emit('error', new Error('end called on destroyed Elastic APM client'))
    cb()
    return
  }
  clients[this._index] = null // remove global reference to ease garbage collection
  this._ref()
  this._stream.end()
  cb()
}

// Overwrite destroy instead of using _destroy because readable-stream@2 can't
// be trusted. After a stream is destroyed, we want a call to either
// client.write() or client.end() to both emit an error and call the provided
// callback. Unfortunately, in readable-stream@2 and Node.js <10, this is not
// consistent. This has been fixed in Node.js 10 and will also be fixed in
// readable-stream@3.
Client.prototype.destroy = function (err) {
  if (this._destroyed) return
  this._destroyed = true
  if (err) this.emit('error', err)
  clients[this._index] = null // remove global reference to ease garbage collection
  this._stream.destroy()
  this._chopper.destroy()
  this._agent.destroy()
  process.nextTick(() => {
    this.emit('close')
  })
}

function onStream (opts, client, onerror) {
  const meta = opts.meta
  const serverTimeout = opts.serverTimeout
  opts = getRequestOptions(opts, client._agent)

  return function (stream, next) {
    const onerrorproxy = (err) => {
      stream.removeListener('error', onerrorproxy)
      compressor.removeListener('error', onerrorproxy)
      req.removeListener('error', onerrorproxy)
      stream.destroy()
      onerror(err)
    }

    client._active = true

    const req = client._transport.request(opts, onResult(onerror))
    const compressor = zlib.createGzip()

    // Mointor streams for errors so that we can make sure to destory the
    // output stream as soon as that occurs
    stream.on('error', onerrorproxy)
    compressor.on('error', onerrorproxy)
    req.on('error', onerrorproxy)

    req.on('socket', function (socket) {
      // Sockets will automatically be unreffed by the HTTP agent when they are
      // not in use by an HTTP request, but as we're keeping the HTTP request
      // open, we need to unref the socket manually
      socket.unref()
    })

    if (Number.isFinite(serverTimeout)) {
      req.setTimeout(serverTimeout, function () {
        req.abort()
      })
    }

    pump(stream, compressor, req, function () {
      // This function is technically called with an error, but because we
      // manually attach error listeners on all the streams in the pipeline
      // above, we can safely ignore it.
      //
      // We do this for two reasons:
      //
      // 1) This callback might be called a few ticks too late, in which case a
      //    race condition could occur where the user would write to the output
      //    stream before the rest of the system discovered that it was
      //    unwritable
      //
      // 2) The error might occur post the end of the stream. In that case we
      //    would not get it here as the internal error listener would have
      //    been removed and the stream would throw the error instead

      client._active = false
      if (client._onflushed) {
        client._onflushed()
        client._onflushed = null
      }

      next()
    })

    // All requests to the APM Server must start with a metadata object
    stream.write(safeStringify({metadata: meta()}) + '\n')
  }
}

function onResult (onerror) {
  return streamToBuffer.onStream(function (err, buf, res) {
    if (err) return onerror(err)
    if (res.statusCode < 200 || res.statusCode > 299) {
      const err = new Error('Unexpected response code from APM Server: ' + res.statusCode)
      if (buf.length > 0) {
        err.result = buf.toString('utf8')
        if (res.headers['content-type'] === 'application/json') {
          try {
            err.result = JSON.parse(err.result).error || err.result
          } catch (e) {}
        }
      }
      onerror(err)
    }
  })
}

function normalizeOptions (opts) {
  if (!opts.userAgent) throw new Error('Missing required option: userAgent')
  if (!opts.meta) throw new Error('Missing required option: meta')

  const normalized = Object.assign({}, opts, {objectMode: true})

  // default values
  if (!normalized.size && normalized.size !== 0) normalized.size = 1024 * 1024
  if (!normalized.time && normalized.time !== 0) normalized.time = 10000
  if (!normalized.serverTimeout && normalized.serverTimeout !== 0) normalized.serverTimeout = 15000
  if (!normalized.type) normalized.type = StreamChopper.overflow
  if (!normalized.serverUrl) normalized.serverUrl = 'http://localhost:8200'
  normalized.keepAlive = normalized.keepAlive !== false

  // process
  normalized.serverUrl = parseUrl(normalized.serverUrl)

  return normalized
}

function getRequestOptions (opts, agent) {
  const defaultPath = '/v2/intake'
  return {
    agent: agent,
    rejectUnauthorized: opts.rejectUnauthorized !== false,
    hostname: opts.serverUrl.hostname,
    port: opts.serverUrl.port,
    method: 'POST',
    path: opts.serverUrl.path === '/' ? defaultPath : opts.serverUrl.path + defaultPath,
    headers: getHeaders(opts)
  }
}

function getHeaders (opts) {
  const headers = {}
  if (opts.secretToken) headers['Authorization'] = 'Bearer ' + opts.secretToken
  headers['Content-Type'] = 'application/x-ndjson'
  headers['Content-Encoding'] = 'gzip'
  headers['Accept'] = 'application/json'
  headers['User-Agent'] = opts.userAgent + ' ' + pkg.name + '/' + pkg.version
  return Object.assign(headers, opts.headers)
}
