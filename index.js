'use strict'

const parseUrl = require('url').parse
const zlib = require('zlib')
const pump = require('pump')
const ndjson = require('ndjson')
const safeStringify = require('fast-safe-stringify')
const streamToBuffer = require('fast-stream-to-buffer')
const StreamChopper = require('stream-chopper')
const pkg = require('./package')

module.exports = Client

function Client (opts, onerror) {
  opts = normalizeOptions(opts)
  onerror = onerror || throwerr

  const serialize = ndjson.serialize()
  // TODO: Is there a race condition between the `time` config option and the request timeout option?
  const chopper = new StreamChopper(opts).on('stream', onStream(opts, onerror))

  // All sockets on the agent are unreffed when they are created. This means
  // that when those are the only handles left, the `beforeExit` event will be
  // emitted. By listening for this we can make sure to end the requests
  // properly before exiting. This way we don't keep the process running until
  // the `time` timeout happens.
  // TODO: If you start too many clients (e.g. in a test), this will emit a too-many-listeners warning
  process.once('beforeExit', function () {
    opts.agent.ref() // re-ref the open socket handles
    serialize.end()
  })

  pump(serialize, chopper, function (err) {
    if (err) onerror(err)
  })

  return serialize
}

function onStream (opts, onerror) {
  const meta = opts.meta
  const transport = opts.transport
  const serverTimeout = opts.serverTimeout
  opts = getRequestOptions(opts)

  return function (stream, next) {
    const req = transport.request(opts, onResult(onerror))

    req.on('socket', function (socket) {
      // Sockets will automatically be unreffed by the HTTP agent when they are
      // not in use by an HTTP request, but as we're keeping the HTTP request
      // open, we need to unref the socket manually
      socket.unref()
    })

    // TODO: It doesn't really make sense to set req.serverTimeout on a
    // streaming request before all the data is sent. We need find a solution
    // for how to handle timeout of the response.
    if (Number.isFinite(serverTimeout)) {
      req.setTimeout(serverTimeout, function () {
        req.abort()
      })
    }

    pump(stream, zlib.createGzip(), req, function (err) {
      if (err) onerror(err)
      // Add listener for req errors in case a timeout occurs AFTER the request
      // finishes
      //
      // TODO: This will produce two errors, which might not be that nice
      // - First one is caught by the if-sentence above (premature closure)
      // - Second one is caught by the listener below (socket hung up)
      req.on('error', onerror)
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

  const normalized = Object.assign({}, opts)

  // default values
  if (!normalized.size && normalized.size !== 0) normalized.size = 1024 * 1024
  if (!normalized.time && normalized.time !== 0) normalized.time = 10000
  if (!normalized.serverTimeout && normalized.serverTimeout !== 0) normalized.serverTimeout = 15000
  if (!normalized.type) normalized.type = StreamChopper.overflow
  if (!normalized.serverUrl) normalized.serverUrl = 'http://localhost:8200'
  normalized.keepAlive = normalized.keepAlive !== false

  // process
  normalized.serverUrl = parseUrl(normalized.serverUrl)
  normalized.transport = require(normalized.serverUrl.protocol.slice(0, -1)) // 'http:' => 'http'
  normalized.agent = getAgent(normalized)

  return normalized
}

function getAgent (opts) {
  // TODO: Consider use of maxSockets and maxFreeSockets
  const agent = new opts.transport.Agent({keepAlive: opts.keepAlive})

  agent.ref = function () {
    Object.keys(agent.sockets).forEach(function (remote) {
      agent.sockets[remote].forEach(function (socket) {
        socket.ref()
      })
    })
  }

  return agent
}

function getRequestOptions (opts) {
  const defaultPath = '/v2/intake'
  return {
    agent: opts.agent,
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

function throwerr (err) {
  throw err
}
