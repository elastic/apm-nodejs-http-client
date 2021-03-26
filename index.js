'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const util = require('util')
const os = require('os')
const { URL } = require('url')
const zlib = require('zlib')
const querystring = require('querystring')
const Writable = require('readable-stream').Writable
const getContainerInfo = require('./lib/container-info')
const pump = require('pump')
const eos = require('end-of-stream')
const streamToBuffer = require('fast-stream-to-buffer')
const StreamChopper = require('stream-chopper')

const ndjson = require('./lib/ndjson')
const { NoopLogger } = require('./lib/logging')
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

const MAX_QUEUE_SIZE = 1024 // XXX make this configurable a la https://www.elastic.co/guide/en/apm/agent/java/current/config-reporter.html#config-max-queue-size
// const MAX_QUEUE_SIZE = Infinity // XXX make this configurable a la https://www.elastic.co/guide/en/apm/agent/java/current/config-reporter.html#config-max-queue-size
const containerInfo = getContainerInfo()

const node8 = process.version.indexOf('v8.') === 0

// All sockets on the agent are unreffed when they are created. This means that
// when those are the only handles left, the `beforeExit` event will be
// emitted. By listening for this we can make sure to end the requests properly
// before exiting. This way we don't keep the process running until the `time`
// timeout happens.
const clientsToAutoEnd = []
process.once('beforeExit', function () {
  clientsToAutoEnd.forEach(function (client) {
    if (!client) {
      // Clients remove themselves from the array when they end.
      return
    }
    client._log.trace('auto-end client beforeExit')
    client.end()
  })
})

util.inherits(Client, Writable)

Client.encoding = Object.freeze({
  METADATA: Symbol('metadata'),
  TRANSACTION: Symbol('transaction'),
  SPAN: Symbol('span'),
  ERROR: Symbol('error'),
  METRICSET: Symbol('metricset')
})

function Client (opts) {
  if (!(this instanceof Client)) return new Client(opts)

  Writable.call(this, { objectMode: true })

  this._corkTimer = null
  this._agent = null
  this._active = false
  this._onflushed = null
  this._transport = null
  this._configTimer = null
  this._encodedMetadata = null
  this._backoffReconnectCount = 0

  // Internal runtime stats for developer debugging/tuning.
  this._numEvents = 0 // number of events given to the client
  this._numEventsDropped = 0 // number of events dropped because overloaded
  this._numEventsEnqueued = 0 // number of events written through to chopper
  this.sent = 0 // number of events sent to APM server (not necessarily accepted)
  this._slowWriteBatch = { // data on slow or the slowest _writeBatch
    numOver10Ms: 0,
    // Data for the slowest _writeBatch:
    encodeTimeMs: 0,
    fullTimeMs: 0,
    numEvents: 0,
    numBytes: 0
  }

  this.config(opts)
  this._log = this._conf.logger || new NoopLogger()

  // start stream in corked mode, uncork when cloud
  // metadata is fetched and assigned.  Also, the
  // _maybeUncork will not uncork until _encodedMetadata
  // is set
  this.cork()
  this._fetchAndEncodeMetadata(() => {
    // _fetchAndEncodeMetadata will have set/memoized the encoded
    // metadata to the _encodedMetadata property.

    // This reverses the cork() call in the constructor above. "Maybe" uncork,
    // in case the client has been destroyed before this callback is called.
    this._maybeUncork()

    // the `cloud-metadata` event allows listeners to know when the
    // agent has finished fetching and encoding its metadata for the
    // first time
    this.emit('cloud-metadata', this._encodedMetadata)
  })

  this._chopper = new StreamChopper({
    size: this._conf.size,
    time: this._conf.time,
    type: StreamChopper.overflow,
    transform () {
      return zlib.createGzip()
    }
  })
  const onIntakeError = (err) => {
    if (this.destroyed === false) {
      this.emit('request-error', err)
    }
  }
  this._chopper.on('stream', getChoppedStreamHandler(this, onIntakeError))

  const fail = () => {
    if (this._writableState.ending === false) this.destroy()
  }
  eos(this._chopper, fail)

  this._index = clientsToAutoEnd.length
  clientsToAutoEnd.push(this)

  if (this._conf.centralConfig) {
    this._pollConfig()
  }
}

// Return current internal stats.
Client.prototype._getStats = function () {
  return {
    numEvents: this._numEvents,
    numEventsDropped: this._numEventsDropped,
    numEventsEnqueued: this._numEventsEnqueued,
    numEventsSent: this.sent,
    slowWriteBatch: this._slowWriteBatch,
    backoffReconnectCount: this._backoffReconnectCount
  }
}

Client.prototype.config = function (opts) {
  this._conf = Object.assign(this._conf || {}, opts)

  this._conf.globalLabels = normalizeGlobalLabels(this._conf.globalLabels)

  const missing = requiredOpts.filter(name => !this._conf[name])
  if (missing.length > 0) throw new Error('Missing required option(s): ' + missing.join(', '))

  // default values
  if (!this._conf.size && this._conf.size !== 0) this._conf.size = 750 * 1024
  if (!this._conf.time && this._conf.time !== 0) this._conf.time = 10000
  if (!this._conf.serverTimeout && this._conf.serverTimeout !== 0) this._conf.serverTimeout = 15000
  if (!this._conf.serverUrl) this._conf.serverUrl = 'http://localhost:8200'
  if (!this._conf.hostname) this._conf.hostname = hostname
  if (!this._conf.environment) this._conf.environment = process.env.NODE_ENV || 'development'
  if (!this._conf.truncateKeywordsAt) this._conf.truncateKeywordsAt = 1024
  if (!this._conf.truncateErrorMessagesAt) this._conf.truncateErrorMessagesAt = 2048
  if (!this._conf.truncateStringsAt) this._conf.truncateStringsAt = 1024
  if (!this._conf.truncateCustomKeysAt) this._conf.truncateCustomKeysAt = 1024
  if (!this._conf.truncateQueriesAt) this._conf.truncateQueriesAt = 10000
  if (!this._conf.bufferWindowTime) this._conf.bufferWindowTime = 20
  if (!this._conf.bufferWindowSize) this._conf.bufferWindowSize = 50
  this._conf.keepAlive = this._conf.keepAlive !== false
  this._conf.centralConfig = this._conf.centralConfig || false

  // processed values
  this._conf.serverUrl = new URL(this._conf.serverUrl)

  if (containerInfo) {
    if (!this._conf.containerId && containerInfo.containerId) {
      this._conf.containerId = containerInfo.containerId
    }
    if (!this._conf.kubernetesPodUID && containerInfo.podId) {
      this._conf.kubernetesPodUID = containerInfo.podId
    }
    if (!this._conf.kubernetesPodName && containerInfo.podId) {
      this._conf.kubernetesPodName = hostname
    }
  }

  switch (this._conf.serverUrl.protocol) {
    case 'http:':
      this._transport = http
      break
    case 'https:':
      this._transport = https
      break
    default:
      throw new Error('Unknown protocol ' + this._conf.serverUrl.protocol)
  }

  // Only reset `this._agent` if the serverUrl has changed to avoid
  // unnecessarily abandoning keep-alive connections.
  if (!this._agent || (opts && 'serverUrl' in opts)) {
    if (this._agent) {
      this._agent.destroy()
    }
    var agentOpts = {
      keepAlive: this._conf.keepAlive,
      keepAliveMsecs: this._conf.keepAliveMsecs,
      maxSockets: this._conf.maxSockets,
      maxFreeSockets: this._conf.maxFreeSockets
    }
    this._agent = new this._transport.Agent(agentOpts)
  }

  // http request options
  this._conf.requestIntake = getIntakeRequestOptions(this._conf, this._agent)
  this._conf.requestConfig = getConfigRequestOptions(this._conf, this._agent)

  this._conf.metadata = getMetadata(this._conf)

  // fixes bug where cached/memoized _encodedMetadata wouldn't be
  // updated when client was reconfigured
  if (this._encodedMetadata) {
    this.updateEncodedMetadata()
  }
}

/**
 * Updates the encoded metadata without refetching cloud metadata
 */
Client.prototype.updateEncodedMetadata = function () {
  const oldMetadata = JSON.parse(this._encodedMetadata)
  const toEncode = { metadata: this._conf.metadata }
  if (oldMetadata.metadata.cloud) {
    toEncode.metadata.cloud = oldMetadata.metadata.cloud
  }
  this._encodedMetadata = this._encode(toEncode, Client.encoding.METADATA)
}

Client.prototype._pollConfig = function () {
  const opts = this._conf.requestConfig
  if (this._conf.lastConfigEtag) {
    opts.headers['If-None-Match'] = this._conf.lastConfigEtag
  }

  const req = this._transport.get(opts, res => {
    res.on('error', err => {
      // Not sure this event can ever be emitted, but just in case
      res.destroy(err)
    })

    this._scheduleNextConfigPoll(getMaxAge(res))

    if (
      res.statusCode === 304 || // No new config since last time
      res.statusCode === 403 || // Central config not enabled in APM Server
      res.statusCode === 404 // Old APM Server that doesn't support central config
    ) {
      res.resume()
      return
    }

    streamToBuffer(res, (err, buf) => {
      if (err) {
        this.emit('request-error', processConfigErrorResponse(res, buf, err))
        return
      }

      if (res.statusCode === 200) {
        // 200: New config available (or no config for the given service.name / service.environment)
        const etag = res.headers.etag
        if (etag) this._conf.lastConfigEtag = etag

        let config
        try {
          config = JSON.parse(buf)
        } catch (parseErr) {
          this.emit('request-error', processConfigErrorResponse(res, buf, parseErr))
          return
        }
        this.emit('config', config)
      } else {
        this.emit('request-error', processConfigErrorResponse(res, buf))
      }
    })
  })

  req.on('error', err => {
    this._scheduleNextConfigPoll()
    this.emit('request-error', err)
  })
}

Client.prototype._scheduleNextConfigPoll = function (seconds) {
  if (this._configTimer !== null) return

  seconds = seconds || 300

  this._configTimer = setTimeout(() => {
    this._configTimer = null
    this._pollConfig()
  }, seconds * 1000)

  this._configTimer.unref()
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
    const t = process.hrtime()
    const chunk = this._encode(obj, enc)
    this._numEventsEnqueued++
    this._chopper.write(chunk, cb)
    this._log.trace({
      fullTimeMs: deltaMs(t),
      numEvents: 1,
      numBytes: chunk.length
    }, '_write: encode object')
  }
}

Client.prototype._writev = function (objs, cb) {
  // Limit the size of individual writes to manageable batches, primarily to
  // limit large sync pauses due to `_encode`ing in `_writeBatch`. This value
  // is not particularly well tuned. It was selected to get sync pauses under
  // 10ms on a developer machine.
  const MAX_WRITE_BATCH_SIZE = 32

  let offset = 0

  const processBatch = () => {
    if (this.destroyed) {
      cb()
      return
    }

    let flushIdx = -1
    const limit = Math.min(objs.length, offset + MAX_WRITE_BATCH_SIZE)
    for (let i = offset; i < limit; i++) {
      if (objs[i].chunk === flush) {
        flushIdx = i
        break
      }
    }

    if (offset === 0 && flushIdx === -1 && objs.length <= MAX_WRITE_BATCH_SIZE) {
      // A shortcut if there is no `flush` and the whole `objs` fits in a batch.
      this._writeBatch(objs, cb)
    } else if (flushIdx === -1) {
      // No `flush` in this batch.
      this._writeBatch(objs.slice(offset, limit),
        limit === objs.length ? cb : processBatch)
      offset = limit
    } else if (flushIdx > offset) {
      // There are some events in the queue before a `flush`.
      this._writeBatch(objs.slice(offset, flushIdx), processBatch)
      offset = flushIdx
    } else if (flushIdx === objs.length - 1) {
      // The next item is a flush, and it is the *last* item in the queue.
      this._writeFlush(cb)
    } else {
      // the next item in the queue is a flush
      this._writeFlush(processBatch)
      offset++
    }
  }

  processBatch()
}

function encodeObject (obj) {
  return this._encode(obj.chunk, obj.encoding)
}

// Write a batch of events (excluding specially handled "flush" events) to
// the stream chopper.
Client.prototype._writeBatch = function (objs, cb) {
  const t = process.hrtime()
  const chunk = objs.map(encodeObject.bind(this)).join('')
  const encodeTimeMs = deltaMs(t)

  this._numEventsEnqueued += objs.length
  this._chopper.write(chunk, cb)
  const fullTimeMs = deltaMs(t)

  if (fullTimeMs > this._slowWriteBatch.fullTimeMs) {
    this._slowWriteBatch.encodeTimeMs = encodeTimeMs
    this._slowWriteBatch.fullTimeMs = fullTimeMs
    this._slowWriteBatch.numEvents = objs.length
    this._slowWriteBatch.numBytes = chunk.length
  }
  if (fullTimeMs > 10) {
    this._slowWriteBatch.numOver10Ms++
  }
  this._log.trace({
    encodeTimeMs: encodeTimeMs,
    fullTimeMs: fullTimeMs,
    numEvents: objs.length,
    numBytes: chunk.length
  }, '_writeBatch')
}

Client.prototype._writeFlush = function (cb) {
  this._log.trace('_writeFlush')
  if (this._active) {
    this._onflushed = cb
    this._chopper.chop()
  } else {
    this._chopper.chop(cb)
  }
}

Client.prototype._maybeCork = function () {
  if (!this._writableState.corked && this._conf.bufferWindowTime !== -1) {
    // this._log.trace('cork (from _maybeCork)')
    this.cork()
    if (this._corkTimer && this._corkTimer.refresh) {
      // the refresh function was added in Node 10.2.0
      this._corkTimer.refresh()
    } else {
      this._corkTimer = setTimeout(() => {
        this.uncork()
      }, this._conf.bufferWindowTime)
    }
  } else if (this._writableState.length >= this._conf.bufferWindowSize) {
    this._maybeUncork()
  }
}

Client.prototype._maybeUncork = function () {
  // client must remain corked until cloud metadata has been
  // fetched-or-skipped.
  if (!this._encodedMetadata) {
    return
  }

  if (this._writableState.corked) {
    // Wait till next tick, so that the current write that triggered the call
    // to `_maybeUncork` have time to be added to the queue. If we didn't do
    // this, that last write would trigger a single call to `_write`.
    process.nextTick(() => {
      if (this.destroyed === false) {
        this.uncork()
      }
    })

    if (this._corkTimer) {
      clearTimeout(this._corkTimer)
      this._corkTimer = null
    }
  }
}

Client.prototype._encode = function (obj, enc) {
  const out = {}
  switch (enc) {
    case Client.encoding.SPAN:
      out.span = truncate.span(obj.span, this._conf)
      break
    case Client.encoding.TRANSACTION:
      out.transaction = truncate.transaction(obj.transaction, this._conf)
      break
    case Client.encoding.METADATA:
      out.metadata = truncate.metadata(obj.metadata, this._conf)
      break
    case Client.encoding.ERROR:
      out.error = truncate.error(obj.error, this._conf)
      break
    case Client.encoding.METRICSET:
      out.metricset = truncate.metricset(obj.metricset, this._conf)
      break
  }
  return ndjson.serialize(out)
}

// With the cork/uncork handling on this stream, `this.write`ing on this
// stream when already destroyed will lead to:
//    Error: Cannot call write after a stream was destroyed
// when the `_corkTimer` expires.
Client.prototype._isUnsafeToWrite = function () {
  return this.destroyed
}

Client.prototype._shouldDropEvent = function () {
  this._numEvents++
  if (this._numEvents % 10000 === 0) { // XXX
    this._log.trace('maor events: numEvents=%d', this._numEvents)
  }

  const shouldDrop = this._writableState.length >= MAX_QUEUE_SIZE
  if (shouldDrop) {
    this._numEventsDropped++
  }
  return shouldDrop
}

Client.prototype.sendSpan = function (span, cb) {
  if (this._isUnsafeToWrite() || this._shouldDropEvent()) {
    return
  }
  this._maybeCork()
  return this.write({ span }, Client.encoding.SPAN, cb)
}

Client.prototype.sendTransaction = function (transaction, cb) {
  if (this._isUnsafeToWrite() || this._shouldDropEvent()) {
    return
  }
  this._maybeCork()
  return this.write({ transaction }, Client.encoding.TRANSACTION, cb)
}

Client.prototype.sendError = function (error, cb) {
  if (this._isUnsafeToWrite() || this._shouldDropEvent()) {
    return
  }
  this._maybeCork()
  return this.write({ error }, Client.encoding.ERROR, cb)
}

Client.prototype.sendMetricSet = function (metricset, cb) {
  if (this._isUnsafeToWrite() || this._shouldDropEvent()) {
    return
  }
  this._maybeCork()
  return this.write({ metricset }, Client.encoding.METRICSET, cb)
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
  this._log.trace('_final')
  if (this._configTimer) {
    clearTimeout(this._configTimer)
    this._configTimer = null
  }
  clientsToAutoEnd[this._index] = null // remove global reference to ease garbage collection
  this._ref()
  this._chopper.end()
  cb()
}

Client.prototype._destroy = function (err, cb) {
  this._log.trace({ err }, '_destroy')
  if (this._configTimer) {
    clearTimeout(this._configTimer)
    this._configTimer = null
  }
  if (this._corkTimer) {
    clearTimeout(this._corkTimer)
    this._corkTimer = null
  }
  clientsToAutoEnd[this._index] = null // remove global reference to ease garbage collection
  this._chopper.destroy()
  this._agent.destroy()
  cb(err)
}

// Return the appropriate backoff delay (in milliseconds) before a next possible
// request to APM server.
// Spec: https://github.com/elastic/apm/blob/master/specs/agents/transport.md#transport-errors
Client.prototype._getBackoffDelay = function (isErr) {
  let reconnectCount = this._backoffReconnectCount
  if (isErr) {
    this._backoffReconnectCount++
  } else {
    this._backoffReconnectCount = 0
    reconnectCount = 0
  }

  // min(reconnectCount++, 6) ** 2 ± 10%
  const delayS = Math.pow(Math.min(reconnectCount, 6), 2)
  const jitterS = delayS * (0.2 * Math.random() - 0.1)
  const delayMs = (delayS + jitterS) * 1000
  return delayMs
}

function getChoppedStreamHandler (client, onerror) {
  // Make a request to the apm-server intake API.
  // https://www.elastic.co/guide/en/apm/server/current/events-api.html
  //
  // In normal operation this works as follows:
  // - The StreamChopper (`this._chopper`) calls this function with a newly
  //   created Gzip stream, to which it writes encoded event data.
  // - It `gzipStream.end()`s the stream when:
  //   (a) approximately `apiRequestSize` of data have been written,
  //   (b) `apiRequestTime` seconds have passed, or
  //   (c) `_chopper.chop()` is explicitly called via `client.flush()`,
  //       e.g. used by the Node.js APM agent after `client.sendError()`.
  // - This function makes the HTTP POST to the apm-server, pipes the gzipStream
  //   to it, waits for the completion of the request and the apm-server
  //   response.
  // - Then it calls the given `next` callback to signal StreamChopper that
  //   another chopped stream can be created, when there is more the send.
  //
  // XXX clean this up if don't actually used those "quoted-names"
  // Of course, things can go wrong. Here are the known ways this pipeline can
  // conclude. (The "quoted-names" in this list are used for reference in the
  // test suite and code comments.)
  // - "intakeRes-success" - A successful response from the APM server. This is
  //   the normal operation case described above.
  // - "gzipStream-error" - An "error" event on the gzip stream.
  // - "intakeReq-error" - An "error" event on the intake HTTP request, e.g.
  //   ECONNREFUSED or ECONNRESET.
  // - "serverTimeout" - An idle timeout value (default 30s) set on the
  //   socket. This is a catch-all fallback for an otherwised wedged connection.
  //   If this is being hit, there is some major issue in the application
  //   (possibly a bug in the APM agent).
  // - "intakeResponseTimeout" - A timer started *after* we are finished sending
  //   data to the APM server by which we require a response (including its
  //   body). By default this is 10s -- a very long time to allow for a slow or
  //   far apm-server. If we hit this, APM server is problematic anyway, so
  //   the delay doesn't add to the problems.
  // - XXX "Q: How is an intake request terminated for http-client shutdown?" from ticket notes
  //    - agent.destroy() -> chopper.destroy() -> destroyStream() -> special handling for
  //      Gzip streams... with things about "close" and stream.destroy() or stream.close()
  //      Will need test cases for this.
  //    - How is "flush" in here, if at all?
  return function makeIntakeRequest (gzipStream, next) {
    const reqId = crypto.randomBytes(16).toString('hex')
    const log = client._log.child({ reqId })
    const startTime = process.hrtime()
    const timeline = []
    let bytesWritten = 0
    let intakeRes
    let intakeResTimer = null
    const INTAKE_RES_TIMEOUT_S = 10 // XXX make this configurable as `intakeResponseTimeout`?

    // `_active` is used to coordinate the callback to `client.flush(db)`.
    client._active = true

    // Handle conclusion of this intake request. Each "part" is expected to call
    // `completePart()` at least once -- multiple calls are okay for cases like
    // the "error" and "close" events on a stream being called. When a part
    // errors or all parts are completed, then we can conclude.
    let concluded = false
    const completedFromPart = {
      gzipStream: false,
      intakeReq: false,
      intakeRes: false
    }
    let numToComplete = Object.keys(completedFromPart).length
    const completePart = (part, err) => {
      log.trace({ err, concluded }, 'completePart %s', part)
      timeline.push([deltaMs(startTime), `completePart ${part}`, err && err.message])
      assert(part in completedFromPart, `'${part}' is in completedFromPart`)

      if (concluded) {
        return
      }

      // If this is the final part to complete, then we are ready to conclude.
      let allPartsCompleted = false
      if (!completedFromPart[part]) {
        completedFromPart[part] = true
        numToComplete--
        if (numToComplete === 0) {
          allPartsCompleted = true
        }
      }
      if (!err && !allPartsCompleted) {
        return
      }

      // Conclude.
      concluded = true
      if (err) {
        // There was an error: clean up resources.

        // Note that in Node v8, destroying the gzip stream results in it
        // emitting an "error" event as follows. No harm, however.
        //    Error: gzip stream error: zlib binding closed
        //      at Gzip._transform (zlib.js:369:15)
        //      ...
        destroyStream(gzipStream)
        intakeReq.destroy()
        if (intakeResTimer) {
          log.trace('cancel intakeResTimer')
          clearTimeout(intakeResTimer)
          intakeResTimer = null
        }
      }

      client.sent = client._numEventsEnqueued
      client._active = false
      if (client._onflushed) {
        client._onflushed()
        client._onflushed = null
      }

      const backoffDelayMs = client._getBackoffDelay(!!err)
      if (err) {
        log.trace({ timeline, bytesWritten, backoffDelayMs, err },
          'conclude intake request: error')
        onerror(err)
      } else {
        log.trace({ timeline, bytesWritten, backoffDelayMs },
          'conclude intake request: success')
      }
      if (backoffDelayMs > 0) {
        setTimeout(next, backoffDelayMs).unref()
      } else {
        next()
      }
    }

    // Start the request and set its timeout.
    const intakeReq = client._transport.request(client._conf.requestIntake)
    if (Number.isFinite(client._conf.serverTimeout)) {
      intakeReq.setTimeout(client._conf.serverTimeout)
    }
    /*
    TODO: want client req and client res support from ecs-logging.
    - at the least it cannot crash
    - want to dwim it? i.e. both types to same 'req' and 'res' fields? Probably, yes.

    XXX ecs-logging crash bug from:
          log.trace({req: intakeReq}, 'intake request start')

    This is the diff between a *client* request from `req = http.request(...)`
    and the request received by a server `http.createServer(..., function (req, res) { ... })`

    /Users/trentm/tm/apm-agent-nodejs/node_modules/@elastic/ecs-helpers/lib/http-formatters.js:49
      ecs.url.full = (socket && socket.encrypted ? 'https://' : 'http://') + headers.host + url
                                                                                    ^

    TypeError: Cannot read property 'host' of undefined
        at formatHttpRequest (/Users/trentm/tm/apm-agent-nodejs/node_modules/@elastic/ecs-helpers/lib/http-formatters.js:49:82)
        at Object.ecsPinoOptions.formatters.log (/Users/trentm/tm/apm-agent-nodejs/node_modules/@elastic/ecs-pino-format/index.js:161:11)
        at Pino.asJson (/Users/trentm/tm/apm-agent-nodejs/node_modules/pino/lib/tools.js:109:22)
        at Pino.write (/Users/trentm/tm/apm-agent-nodejs/node_modules/pino/lib/proto.js:166:28)
        at Pino.LOG [as trace] (/Users/trentm/tm/apm-agent-nodejs/node_modules/pino/lib/tools.js:55:21)
        at StreamChopper.makeIntakeRequest (/Users/trentm/tm/apm-nodejs-http-client/index.js:677:9)
        at StreamChopper.emit (events.js:315:20)
        ...

    XXX ecs-logging crash bug #2 from:
      log.trace({res: intakeRes}, 'intakeReq "response"')

        /Users/trentm/tm/apm-agent-nodejs/node_modules/@elastic/ecs-helpers/lib/http-formatters.js:120
      const headers = res.getHeaders()
                          ^

    TypeError: res.getHeaders is not a function
        at formatHttpResponse (/Users/trentm/tm/apm-agent-nodejs/node_modules/@elastic/ecs-helpers/lib/http-formatters.js:120:23)
        at Object.ecsPinoOptions.formatters.log (/Users/trentm/tm/apm-agent-nodejs/node_modules/@elastic/ecs-pino-format/index.js:168:11)
        at Pino.asJson (/Users/trentm/tm/apm-agent-nodejs/node_modules/pino/lib/tools.js:109:22)
        at Pino.write (/Users/trentm/tm/apm-agent-nodejs/node_modules/pino/lib/proto.js:166:28)
        at Pino.LOG [as trace] (/Users/trentm/tm/apm-agent-nodejs/node_modules/pino/lib/tools.js:55:21)
        at ClientRequest.<anonymous> (/Users/trentm/tm/apm-nodejs-http-client/index.js:719:11)
        ...
    */
    log.trace('intake request start')

    // Handle events on the intake request.
    // https://nodejs.org/api/http.html#http_http_request_options_callback docs
    // emitted events on the req and res objects for different scenarios.
    intakeReq.on('timeout', () => {
      log.trace('intakeReq "timeout"')
      // `.destroy(err)` will result in an "error" event.
      intakeReq.destroy(new Error(`APM Server response timeout (${client._conf.serverTimeout}ms)`))
    })

    intakeReq.on('socket', function (socket) {
      // Unref the socket for this request so that the Client does not keep
      // the node process running if it otherwise would be done. (This is
      // tested by the "unref-client" test in test/side-effects.js.)
      //
      // The HTTP keep-alive agent will unref sockets when unused, and ref them
      // during a request. Given that the normal makeIntakeRequest behaviour
      // is to keep a request open for up to 10s (`apiRequestTimeout`), we must
      // manually unref the socket.
      log.trace('intakeReq "socket": unref it')
      socket.unref()
    })

    intakeReq.on('response', (intakeRes_) => {
      intakeRes = intakeRes_
      log.trace({ statusCode: intakeRes.statusCode, reqFinished: intakeReq.finished },
        'intakeReq "response"')
      let err
      const chunks = []

      if (!intakeReq.finished) {
        // Premature response from APM server. Typically this is for errors
        // like "queue is full", for which the response body will be parsed
        // below. However, set an `err` as a fallback for the unexpected case
        // that is with a 2xx response.
        if (intakeRes.statusCode >= 200 && intakeRes.statusCode < 300) {
          err = new Error(`premature apm-server response with statusCode=${intakeRes.statusCode}`)
        }
        // There is no point (though no harm) in sending more data to the APM
        // server. In case reading the error response body takes a while, pause
        // the gzip stream until it is destroyed in `completePart()`.
        gzipStream.pause()
      }

      // Handle events on the intake response.
      intakeRes.on('error', (intakeResErr) => {
        // I am not aware of a way to get an "error" event on the
        // IncomingMessage (see also https://stackoverflow.com/q/53691119), but
        // handling it here is preferable to an uncaughtException.
        intakeResErr = wrapError(intakeResErr, 'intake response error event')
        completePart('intakeRes', intakeResErr)
      })
      intakeRes.on('data', (chunk) => {
        chunks.push(chunk)
      })
      // intakeRes.on('close', () => { log.trace('intakeRes "close"') })
      // intakeRes.on('aborted', () => { log.trace('intakeRes "aborted"') })
      intakeRes.on('end', () => {
        log.trace('intakeRes "end"')
        if (intakeResTimer) {
          clearTimeout(intakeResTimer)
          intakeResTimer = null
        }
        if (intakeRes.statusCode < 200 || intakeRes.statusCode > 299) {
          err = processIntakeErrorResponse(intakeRes, bufFromChunks(chunks))
        }
        completePart('intakeRes', err)
      })
    })

    // intakeReq.on('abort', () => { log.trace('intakeReq "abort"') })
    // intakeReq.on('close', () => { log.trace('intakeReq "close"') })
    // XXX What was the error scenario that led me to use 'close' instead of 'finish' here?
    intakeReq.on('finish', () => {
      log.trace('intakeReq "finish"')
      completePart('intakeReq')
    })
    intakeReq.on('error', (err) => {
      log.trace('intakeReq "error"')
      completePart('intakeReq', err)
    })

    // Handle events on the gzip stream.
    gzipStream.on('data', (chunk) => {
      bytesWritten += chunk.length
    })
    gzipStream.on('error', (gzipErr) => {
      log.trace('gzipStream "error"')
      gzipErr = wrapError(gzipErr, 'gzip stream error')
      completePart('gzipStream', gzipErr)
    })
    gzipStream.on('finish', () => {
      // If the apm-server is not reading its input and the gzip data is large
      // enough to fill buffers, then the gzip stream will emit "finish", but
      // not "end". Therefore, this "finish" event is the best indicator that
      // the ball is now in the apm-server's court. I.e. we can start a timer
      // waiting on the response, provided we still expect one (we don't if
      // the request has already errored out, e.g. ECONNREFUSED) and it hasn't
      // already completed (e.g. if it replied quickly with "queue is full").
      log.trace('gzipStream "finish"')
      if (!completedFromPart.intakeReq && !completedFromPart.intakeRes) {
        log.trace({ timeout: INTAKE_RES_TIMEOUT_S }, 'start intakeResTimer')
        intakeResTimer = setTimeout(() => {
          completePart('intakeRes',
            new Error('intake response timeout: APM server did not respond ' +
              `within ${INTAKE_RES_TIMEOUT_S}s of gzip stream finish`))
        }, INTAKE_RES_TIMEOUT_S * 1000).unref()
      }
    })
    // gzipStream.on('end', () => { log.trace('gzipStream "end"') })
    gzipStream.on('close', () => {
      log.trace('gzipStream "close"')
      completePart('gzipStream')
    })

    // Hook up writing data to a file (only intended for local debugging).
    // Append the intake data to `payloadLogFile`, if given. This is only
    // intended for local debugging because it can have a significant perf
    // impact.
    if (client._conf.payloadLogFile) {
      const payloadLogStream = fs.createWriteStream(client._conf.payloadLogFile, { flags: 'a' })
      gzipStream.pipe(zlib.createGunzip()).pipe(payloadLogStream)
    }

    // Send the metadata object (always first) and hook up the streams.
    assert(client._encodedMetadata, 'client._encodedMetadata is set')
    gzipStream.write(client._encodedMetadata)
    gzipStream.pipe(intakeReq)
  }

  /* eslint-disable-next-line no-unused-vars */
  function onStream (stream, next) {
    const startT = process.hrtime()
    const startL = client._writableState.length
    client._log.trace({ queueLen: client._writableState.length }, 'onStream: start')
    const timeline = [['start', deltaMs(startT)]]

    const onerrorproxy = (err) => {
      stream.removeListener('error', onerrorproxy)
      req.removeListener('error', onerrorproxy)
      destroyStream(stream)
      onerror(err)
    }

    client._active = true

    const req = client._transport.request(client._conf.requestIntake, onResult(onerror))

    // Abort the current request if the server responds prior to the request
    // being finished
    req.on('response', function (res) {
      console.warn('XXX onStream response', res.statusCode, res.headers)
      if (!req.finished) {
        // In Node.js 8, the zlib stream will emit a 'zlib binding closed'
        // error when destroyed. Furthermore, the HTTP response will not emit
        // any data events after the request have been destroyed, so it becomes
        // impossible to see the error returned by the server if we abort the
        // request. So for Node.js 8, we'll work around this by closing the
        // stream gracefully.
        //
        // This results in the gzip buffer being flushed and a little more data
        // being sent to the APM Server, but it's better than not getting the
        // error body.
        if (node8) {
          stream.end()
        } else {
          console.warn('XXX call destroyStream from "response" extra event handler')
          destroyStream(stream)
        }
      }
    })

    // Mointor streams for errors so that we can make sure to destory the
    // output stream as soon as that occurs
    stream.on('error', onerrorproxy)
    req.on('error', onerrorproxy)

    req.on('socket', function (socket) {
      // Sockets will automatically be unreffed by the HTTP agent when they are
      // not in use by an HTTP request, but as we're keeping the HTTP request
      // open, we need to unref the socket manually
      socket.unref()
    })

    if (Number.isFinite(client._conf.serverTimeout)) {
      req.setTimeout(client._conf.serverTimeout, function () {
        req.destroy(new Error(`APM Server response timeout (${client._conf.serverTimeout}ms)`))
      })
    }

    stream.on('data', function (chunk) {
      timeline.push(['chunk', deltaMs(startT), chunk.length])
    })
    stream.on('end', function () {
      timeline.push(['end', deltaMs(startT)])
    })
    pump(stream, req, function (pumpErr) {
      console.warn('XXX back from pump: pumpErr=%s', pumpErr)
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

      client.sent = client._numEventsEnqueued
      client._active = false
      if (client._onflushed) {
        client._onflushed()
        client._onflushed = null
      }

      const diffT = process.hrtime(startT)
      const diffL = client._writableState.length - startL
      client._log.trace({
        timeline,
        elapsedMs: diffT[0] * 1e3 + diffT[1] / 1e6,
        queueLenDelta: startL + ' -> ' + client._writableState.length + ' = ' + diffL
      }, 'onStream: finished')
      next()
    })

    // Only intended for local debugging
    if (client._conf.payloadLogFile) {
      if (!client._payloadLogFile) {
        client._payloadLogFile = require('fs').createWriteStream(client._conf.payloadLogFile, { flags: 'a' })
      }

      // Manually write to the file instead of using pipe/pump so that the file
      // handle isn't closed when the stream ends
      stream.pipe(zlib.createGunzip()).on('data', function (chunk) {
        client._payloadLogFile.write(chunk)
      })
    }

    // The _encodedMetadata property _should_ be set in the Client
    // constructor function after making a cloud metadata call.
    //
    // Since we cork data until the client._encodedMetadata is set the
    // following conditional should not be necessary. However, we'll
    // leave it in place out of a healthy sense of caution in case
    // something unsets _encodedMetadata or _encodedMetadata is somehow
    // never set.
    if (!client._encodedMetadata) {
      client._encodedMetadata = client._encode({ metadata: client._conf.metadata }, Client.encoding.METADATA)
    }

    // All requests to the APM Server must start with a metadata object
    stream.write(client._encodedMetadata)
  }
}

/**
 * Fetches cloud metadata and encodes with other metadata
 *
 * This method will encode the fetched cloud-metadata with other metadata
 * and memoize the data into the _encodedMetadata property.  Data will
 * be "returned" to the calling function via the passed in callback.
 *
 * The cloudMetadataFetcher configuration values is an error first callback
 * that fetches the cloud metadata.
 */
Client.prototype._fetchAndEncodeMetadata = function (cb) {
  const toEncode = { metadata: this._conf.metadata }

  if (!this._conf.cloudMetadataFetcher) {
    // no metadata fetcher from the agent -- encode our data and move on
    this._encodedMetadata = this._encode(toEncode, Client.encoding.METADATA)

    process.nextTick(cb, null, this._encodedMetadata)
  } else {
    // agent provided a metadata fetcher function.  Call it, use its return
    // return-via-callback value to set the cloud metadata and then move on
    this._conf.cloudMetadataFetcher.getCloudMetadata((err, cloudMetadata) => {
      if (!err && cloudMetadata) {
        toEncode.metadata.cloud = cloudMetadata
      }
      this._encodedMetadata = this._encode(toEncode, Client.encoding.METADATA)
      cb(err, this._encodedMetadata)
    })
  }
}

function onResult (onerror) {
  return streamToBuffer.onStream(function (err, buf, res) {
    console.warn('XXX onStream onResult read response body: err=%s, res.statusCode=%s', err, res.statusCode)
    if (err) return onerror(err)
    if (res.statusCode < 200 || res.statusCode > 299) {
      onerror(processIntakeErrorResponse(res, buf))
    }
  })
}

function getIntakeRequestOptions (opts, agent) {
  const headers = getHeaders(opts)
  headers['Content-Type'] = 'application/x-ndjson'
  headers['Content-Encoding'] = 'gzip'

  return getBasicRequestOptions('POST', '/intake/v2/events', headers, opts, agent)
}

function getConfigRequestOptions (opts, agent) {
  const path = '/config/v1/agents?' + querystring.stringify({
    'service.name': opts.serviceName,
    'service.environment': opts.environment
  })

  const headers = getHeaders(opts)

  return getBasicRequestOptions('GET', path, headers, opts, agent)
}

function getBasicRequestOptions (method, defaultPath, headers, opts, agent) {
  return {
    agent: agent,
    rejectUnauthorized: opts.rejectUnauthorized !== false,
    ca: opts.serverCaCert,
    hostname: opts.serverUrl.hostname,
    port: opts.serverUrl.port,
    method,
    path: opts.serverUrl.pathname === '/' ? defaultPath : opts.serverUrl.pathname + defaultPath,
    headers
  }
}

function getHeaders (opts) {
  const headers = {}
  if (opts.secretToken) headers.Authorization = 'Bearer ' + opts.secretToken
  if (opts.apiKey) headers.Authorization = 'ApiKey ' + opts.apiKey
  headers.Accept = 'application/json'
  headers['User-Agent'] = `${opts.userAgent} ${pkg.name}/${pkg.version} ${process.release.name}/${process.versions.node}`
  return Object.assign(headers, opts.headers)
}

function getMetadata (opts) {
  var payload = {
    service: {
      name: opts.serviceName,
      environment: opts.environment,
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
      },
      framework: undefined,
      version: undefined,
      node: undefined
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
      platform: process.platform,
      container: undefined,
      kubernetes: undefined
    },
    labels: opts.globalLabels
  }

  if (opts.serviceNodeName) {
    payload.service.node = {
      configured_name: opts.serviceNodeName
    }
  }

  if (opts.serviceVersion) payload.service.version = opts.serviceVersion

  if (opts.frameworkName || opts.frameworkVersion) {
    payload.service.framework = {
      name: opts.frameworkName,
      version: opts.frameworkVersion
    }
  }

  if (opts.containerId) {
    payload.system.container = {
      id: opts.containerId
    }
  }

  if (opts.kubernetesNodeName || opts.kubernetesNamespace || opts.kubernetesPodName || opts.kubernetesPodUID) {
    payload.system.kubernetes = {
      namespace: opts.kubernetesNamespace,
      node: opts.kubernetesNodeName
        ? { name: opts.kubernetesNodeName }
        : undefined,
      pod: (opts.kubernetesPodName || opts.kubernetesPodUID)
        ? { name: opts.kubernetesPodName, uid: opts.kubernetesPodUID }
        : undefined
    }
  }

  if (opts.cloudMetadata) {
    payload.cloud = Object.assign({}, opts.cloudMetadata)
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

function oneOf (value, list) {
  return list.indexOf(value) >= 0
}

function normalizeGlobalLabels (labels) {
  if (!labels) return
  const result = {}

  for (const key of Object.keys(labels)) {
    const value = labels[key]
    result[key] = oneOf(typeof value, ['string', 'number', 'boolean'])
      ? value
      : value.toString()
  }

  return result
}

function getMaxAge (res) {
  const header = res.headers['cache-control']
  const match = header && header.match(/max-age=(\d+)/)
  return parseInt(match && match[1], 10)
}

function bufFromChunks (chunks) {
  switch (chunks.length) {
    case 0:
      return Buffer.allocUnsafe(0)
    case 1:
      return chunks[0]
    default:
      return Buffer.concat(chunks)
  }
}

// Wrap the given Error object, including the given message.
//
// Dev Note: Various techniques exist to wrap `Error`s in node.js and JavaScript
// to provide a cause chain, e.g. see
// https://www.joyent.com/node-js/production/design/errors
// However, I'm not aware of a de facto "winner". Eventually there may be
// https://github.com/tc39/proposal-error-cause
// For now we will simply prefix the existing error object's `message` property.
// This is simple and preserves the root error `stack`.
function wrapError (err, msg) {
  err.message = msg + ': ' + err.message
  return err
}

function processIntakeErrorResponse (res, buf) {
  const err = new Error('Unexpected APM Server response')

  err.code = res.statusCode

  if (buf.length > 0) {
    // https://www.elastic.co/guide/en/apm/server/current/events-api.html#events-api-errors
    const body = buf.toString('utf8')
    const contentType = res.headers['content-type']
    if (contentType && contentType.startsWith('application/json')) {
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

  return err
}

// Construct or decorate an Error instance from a failing response from the
// APM server central config endpoint.
//
// @param {IncomingMessage} res
// @param {Buffer|undefined} buf - Optional. A Buffer holding the response body.
// @param {Error|undefined} err - Optional. A cause Error instance.
function processConfigErrorResponse (res, buf, err) {
  // This library doesn't have a pattern for wrapping errors yet, so if
  // we already have an Error instance, we will just decorate it. That preserves
  // the stack of the root cause error.
  const errMsg = 'Unexpected APM Server response when polling config'
  if (!err) {
    err = new Error(errMsg)
  } else {
    err.message = errMsg + ': ' + err.message
  }

  err.code = res.statusCode

  if (buf && buf.length > 0) {
    const body = buf.toString('utf8')
    const contentType = res.headers['content-type']
    if (contentType && contentType.startsWith('application/json')) {
      try {
        const response = JSON.parse(body)
        if (typeof response === 'string') {
          err.response = response
        } else if (typeof response === 'object' && response !== null && typeof response.error === 'string') {
          err.response = response.error
        } else {
          err.response = body
        }
      } catch (e) {
        err.response = body
      }
    } else {
      err.response = body
    }
  }

  return err
}

// Return the time difference (in milliseconds) between the given time `t`
// (a 2-tuple as returned by `process.hrtime()`) and now.
function deltaMs (t) {
  const d = process.hrtime(t)
  return d[0] * 1e3 + d[1] / 1e6
}
