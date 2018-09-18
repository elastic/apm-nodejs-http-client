'use strict'

const util = require('util')
const os = require('os')
const parseUrl = require('url').parse
const zlib = require('zlib')
const {Writable, PassThrough} = require('readable-stream')
const pump = require('pump')
const eos = require('end-of-stream')
const streamToBuffer = require('fast-stream-to-buffer')
const StreamChopper = require('stream-chopper')
const ndjson = require('./lib/ndjson')
const truncate = require('./lib/truncate')
const pkg = require('./package')

module.exports = Client

const flush = Symbol('flush')
const hostname = os.hostname()
const requiredOpts = [
  'agentName',
  'agentVersion',
  'serviceName',
  'userAgent'
]

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

Client.encoding = Object.freeze({
  METADATA: Symbol('metadata'),
  TRANSACTION: Symbol('transaction'),
  SPAN: Symbol('span'),
  ERROR: Symbol('error')
})

function Client (opts) {
  if (!(this instanceof Client)) return new Client(opts)

  this._opts = opts = normalizeOptions(opts)

  Writable.call(this, opts)

  const errorproxy = (err) => {
    this._errors++

    const retryIndex = this._errors === 0 ? 0 : this._errors - 1
    const jitter = Math.random() * 0.2 + 0.9 // ±10% jitter
    const backoff = (Math.min(retryIndex, 6) ** 2) * 1000 * jitter

    if (backoff > 0) {
      this._chopper.resetTimer(-1) // disable timer to prepare for back-off mode
      this._backoffTimer = setTimeout(() => {
        this._backoffTimer = null
        this._chopper.resetTimer(this._chopperTime)
        if (this._backoffCallback) this._backoffCallback()
      }, backoff)
    }

    if (this.destroyed === false) this.emit('request-error', err)
  }

  const fail = () => {
    if (this._writableState.ending === false) this.destroy()
  }

  this._corkTimer = null
  this._received = 0 // number of events given to the client for reporting
  this.sent = 0 // number of events written to the socket
  this._errors = 0 // number of requests that resulted in an error (dropped connection, non-2xx etc)
  this._chopperSize = opts.size // needed to set highWatermark on buffer if we enter back-off mode
  this._chopperTime = opts.time // needed to restore the normal time if we enter back-off mode
  this._backoffTimer = null
  this._backoffCallback = null
  this._active = false
  this._onflushed = null
  this._transport = require(opts.serverUrl.protocol.slice(0, -1)) // 'http:' => 'http'
  this._agent = new this._transport.Agent(opts)
  this._chopper = new StreamChopper({
    size: opts.size,
    time: opts.time,
    type: StreamChopper.overflow,
    transform () {
      return zlib.createGzip()
    }
  }).on('stream', onStream(opts, this, errorproxy))

  eos(this._chopper, fail)

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
  if (obj === flush) {
    this._writeFlush(cb)
  } else {
    this._received++
    this._chopper.write(this._encode(obj, enc), cb)
  }
}

Client.prototype._writev = function (objs, cb) {
  let offset = 0

  const processBatch = () => {
    let index = -1
    for (let i = offset; i < objs.length; i++) {
      if (objs[i].chunk === flush) {
        index = i
        break
      }
    }

    if (offset === 0 && index === -1) {
      // normally there's no flush object queued, so here's a shortcut that just
      // skips all the complicated splitting logic
      this._writevCleaned(objs, cb)
    } else if (index === -1) {
      // no more flush elements in the queue, just write the rest
      this._writevCleaned(objs.slice(offset), cb)
    } else if (index > offset) {
      // there's a few items in the queue before we need to flush, let's first write those
      this._writevCleaned(objs.slice(offset, index), processBatch)
      offset = index
    } else if (index === objs.length - 1) {
      // the last item in the queue is a flush
      this._writeFlush(cb)
    } else {
      // the next item in the queue is a flush
      this._writeFlush(processBatch)
      offset++
    }
  }

  processBatch()
}

Client.prototype._writevCleaned = function (objs, cb) {
  const chunk = objs.reduce((result, obj) => {
    return result + this._encode(obj.chunk, obj.encoding)
  }, '')

  this._received += objs.length
  this._chopper.write(chunk, cb)
}

Client.prototype._writeFlush = function (cb) {
  if (this._active) {
    this._onflushed = cb
    this._chopper.chop()
  } else {
    this._chopper.chop(cb)
  }
}

Client.prototype._maybeCork = function () {
  if (!this._writableState.corked && this._opts.bufferWindowTime !== -1) {
    this.cork()
    if (this._corkTimer && this._corkTimer.refresh) {
      // the refresh function was added in Node 10.2.0
      this._corkTimer.refresh()
    } else {
      this._corkTimer = setTimeout(() => {
        this.uncork()
      }, this._opts.bufferWindowTime)
    }
  } else if (this._writableState.length >= this._opts.bufferWindowSize) {
    this._maybeUncork()
  }
}

Client.prototype._maybeUncork = function () {
  if (this._writableState.corked) {
    // Wait till next tick, so that the current write that triggered the call
    // to `_maybeUncork` have time to be added to the queue. If we didn't do
    // this, that last write would trigger a single call to `_write`.
    process.nextTick(() => {
      if (this.destroyed === false) this.uncork()
    })

    if (this._corkTimer) clearTimeout(this._corkTimer)
  }
}

Client.prototype._encode = function (obj, enc) {
  switch (enc) {
    case Client.encoding.SPAN:
      truncate.span(obj.span, this._opts)
      break
    case Client.encoding.TRANSACTION:
      truncate.transaction(obj.transaction, this._opts)
      break
    case Client.encoding.METADATA:
      truncate.metadata(obj.metadata, this._opts)
      break
    case Client.encoding.ERROR:
      truncate.error(obj.error, this._opts)
      break
  }
  return ndjson.serialize(obj)
}

Client.prototype.sendSpan = function (span, cb) {
  this._maybeCork()
  return this.write({span}, Client.encoding.SPAN, cb)
}

Client.prototype.sendTransaction = function (transaction, cb) {
  this._maybeCork()
  return this.write({transaction}, Client.encoding.TRANSACTION, cb)
}

Client.prototype.sendError = function (error, cb) {
  this._maybeCork()
  return this.write({error}, Client.encoding.ERROR, cb)
}

Client.prototype.flush = function (cb) {
  this._maybeUncork()

  // Write the special "flush" signal. We do this so that the order of writes
  // and flushes are kept. If we where to just flush the client right here, the
  // internal Writable buffer might still contain data that hasn't yet been
  // given to the _write function.
  return this.write(flush, cb)
}

Client.prototype._final = function (cb) {
  clients[this._index] = null // remove global reference to ease garbage collection
  this._ref()
  this._chopper.end()
  cb()
}

Client.prototype._destroy = function (err, cb) {
  clients[this._index] = null // remove global reference to ease garbage collection
  this._chopper.destroy()
  this._agent.destroy()
  cb(err)
}

function onStream (opts, client, onerror) {
  const serverTimeout = opts.serverTimeout
  const requestOpts = getRequestOptions(opts, client._agent)

  return function (stream, next) {
    let buffer, req
    client._active = true

    stream.on('error', onerrorproxy)

    pump(stream, requestProxy(requestOpts, onResult(client, onerror)), function () {
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

      client.sent = client._received
      client._active = false
      if (client._onflushed) {
        client._onflushed()
        client._onflushed = null
      }

      next()
    })

    // Only intended for local debugging
    if (opts.payloadLogFile) {
      if (!client._payloadLogFile) {
        client._payloadLogFile = require('fs').createWriteStream(opts.payloadLogFile, {flags: 'a'})
      }

      // Manually write to the file instead of using pipe/pump so that the file
      // handle isn't closed when the stream ends
      stream.pipe(zlib.createGunzip()).on('data', function (chunk) {
        client._payloadLogFile.write(chunk)
      })
    }

    // All requests to the APM Server must start with a metadata object
    stream.write(client._encode({metadata: getMetadata(opts)}, Client.encoding.METADATA))

    // Under normal opperation, just make a request and return it. If
    // instructed to back off, make a temporary buffer to hold data until the
    // request can be made
    function requestProxy (opts, onresponse) {
      if (client._backoffTimer) {
        buffer = new PassThrough({highWaterMark: client._chopperSize * 2}) // twice as large to allow overflow
        buffer.on('error', onerrorproxy)

        eos(stream, function () {
          client._backoffCallback = null
          if (client._backoffTimer) {
            // drop all data - back-off still in effect
            buffer.destroy()
          }
        })

        client._backoffCallback = function () {
          client._backoffCallback = null
          req = makeRequest(opts, onresponse)
          buffer.pipe(req)
        }

        return buffer
      } else {
        return makeRequest(opts, onresponse)
      }
    }

    function makeRequest (opts, onresponse) {
      const req = client._transport.request(opts, onresponse)

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

      return req
    }

    // This function is attached to the error event of the different streams so
    // that we can make sure to destroy the output stream as soon as an error
    // occurs
    function onerrorproxy (err) {
      stream.removeListener('error', onerrorproxy)
      if (buffer) buffer.removeListener('error', onerrorproxy)
      if (req) req.removeListener('error', onerrorproxy)
      destroyStream(stream)
      onerror(err)
    }
  }
}

function onResult (client, onerror) {
  return streamToBuffer.onStream(function (err, buf, res) {
    if (err) return onerror(err)
    if (res.statusCode < 200 || res.statusCode > 299) {
      const err = new Error('Unexpected APM Server response')

      err.code = res.statusCode

      if (buf.length > 0) {
        const body = buf.toString('utf8')
        const contentType = res.headers['content-type']
        if (contentType && contentType.indexOf('application/json') === 0) {
          try {
            const data = JSON.parse(body)
            err.accepted = data.accepted
            err.errors = data.errors
            if (!err.errors) err.response = body
          } catch (e) {
            err.response = body
          }
        } else {
          err.response = body
        }
      }

      onerror(err)
    } else {
      client._errors = 0
      client._chopper.resetTimer(client._chopperTime)
    }
  })
}

function normalizeOptions (opts) {
  const missing = requiredOpts.filter(name => !opts[name])
  if (missing.length > 0) throw new Error('Missing required option(s): ' + missing.join(', '))

  const normalized = Object.assign({}, opts, {objectMode: true})

  // default values
  if (!normalized.size && normalized.size !== 0) normalized.size = 750 * 1024
  if (!normalized.time && normalized.time !== 0) normalized.time = 10000
  if (!normalized.serverTimeout && normalized.serverTimeout !== 0) normalized.serverTimeout = 15000
  if (!normalized.serverUrl) normalized.serverUrl = 'http://localhost:8200'
  if (!normalized.hostname) normalized.hostname = hostname
  if (!normalized.truncateKeywordsAt) normalized.truncateKeywordsAt = 1024
  if (!normalized.truncateErrorMessagesAt) normalized.truncateErrorMessagesAt = 2048
  if (!normalized.truncateSourceLinesAt) normalized.truncateSourceLinesAt = 1000
  if (!normalized.bufferWindowTime) normalized.bufferWindowTime = 20
  if (!normalized.bufferWindowSize) normalized.bufferWindowSize = 50
  normalized.keepAlive = normalized.keepAlive !== false

  // process
  normalized.serverUrl = parseUrl(normalized.serverUrl)

  return normalized
}

function getRequestOptions (opts, agent) {
  const defaultPath = '/intake/v2/events'
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

function getMetadata (opts) {
  var payload = {
    service: {
      name: opts.serviceName,
      runtime: {
        name: process.release.name,
        version: process.versions.node
      },
      language: {
        name: 'javascript'
      },
      agent: {
        name: opts.agentName,
        version: opts.agentVersion
      }
    },
    process: {
      pid: process.pid,
      ppid: process.ppid,
      title: process.title,
      argv: process.argv
    },
    system: {
      hostname: opts.hostname,
      architecture: process.arch,
      platform: process.platform
    }
  }

  if (opts.serviceVersion) payload.service.version = opts.serviceVersion

  if (opts.frameworkName || opts.frameworkVersion) {
    payload.service.framework = {
      name: opts.frameworkName,
      version: opts.frameworkVersion
    }
  }

  return payload
}

function destroyStream (stream) {
  if (stream instanceof zlib.Gzip ||
      stream instanceof zlib.Gunzip ||
      stream instanceof zlib.Deflate ||
      stream instanceof zlib.DeflateRaw ||
      stream instanceof zlib.Inflate ||
      stream instanceof zlib.InflateRaw ||
      stream instanceof zlib.Unzip) {
    // Zlib streams doesn't have a destroy function in Node.js 6. On top of
    // that simply calling destroy on a zlib stream in Node.js 8+ will result
    // in a memory leak as the handle isn't closed (an operation normally done
    // by calling close). So until that is fixed, we need to manually close the
    // handle after destroying the stream.
    //
    // PR: https://github.com/nodejs/node/pull/23734
    if (typeof stream.destroy === 'function') {
      // Manually close the stream instead of calling `close()` as that would
      // have emitted 'close' again when calling `destroy()`
      if (stream._handle && typeof stream._handle.close === 'function') {
        stream._handle.close()
        stream._handle = null
      }

      stream.destroy()
    } else if (typeof stream.close === 'function') {
      stream.close()
    }
  } else {
    // For other streams we assume calling destroy is enough
    if (typeof stream.destroy === 'function') stream.destroy()
    // Or if there's no destroy (which Node.js 6 will not have on regular
    // streams), emit `close` as that should trigger almost the same effect
    else if (typeof stream.emit === 'function') stream.emit('close')
  }
}
