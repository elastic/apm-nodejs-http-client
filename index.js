'use strict'

var http = require('http')
var parseUrl = require('url').parse
var zlib = require('zlib')
var stringify = require('fast-safe-stringify')
var pkg = require('./package')

var SUB_USER_AGENT = pkg.name + '/' + pkg.version

var Client = module.exports = function (opts) {
  if (!(this instanceof Client)) return new Client(opts)

  opts = opts || {}

  if (!opts.userAgent) throw new Error('Missing required option: userAgent')

  this.secretToken = opts.secretToken || null
  this.userAgent = opts.userAgent + ' ' + SUB_USER_AGENT

  var url = parseUrl(opts.serverUrl || 'http://localhost:8200')

  this._api = {
    hostname: url.hostname,
    port: url.port,
    transport: url.protocol === 'https:' ? require('https') : http,
    path: url.path === '/' ? '/v1/' : url.path + '/v1/',
    rejectUnauthorized: opts.rejectUnauthorized !== false,
    serverTimeout: opts.serverTimeout
  }
}

Client.prototype.request = function (endpoint, headers, body, cb) {
  var self = this

  if (typeof body === 'function') return this.request(endpoint, {}, headers, body)
  if (!headers) headers = {}

  zlib.gzip(stringify(body), function (err, buffer) {
    if (err) return cb(err)

    if (self.secretToken) headers['Authorization'] = 'Bearer ' + self.secretToken
    headers['Content-Type'] = 'application/json'
    headers['Content-Encoding'] = 'gzip'
    headers['Content-Length'] = buffer.length
    headers['Accept'] = 'application/json'
    headers['User-Agent'] = self.userAgent

    var opts = {
      method: 'POST',
      hostname: self._api.hostname,
      port: self._api.port,
      path: self._api.path + endpoint,
      headers: headers,
      rejectUnauthorized: self._api.rejectUnauthorized
    }

    var req = self._api.transport.request(opts, function (res) {
      var buffers = []
      res.on('data', buffers.push.bind(buffers))
      res.on('end', function () {
        cb(null, res, Buffer.concat(buffers).toString('utf8'))
      })
    })

    if (isFinite(self._api.serverTimeout)) {
      req.setTimeout(self._api.serverTimeout, function () {
        req.abort()
      })
    }

    req.on('error', cb)
    req.end(buffer)
  })
}
