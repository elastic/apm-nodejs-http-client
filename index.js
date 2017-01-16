'use strict'

var https = require('https')
var zlib = require('zlib')
var stringify = require('fast-safe-stringify')
var pkg = require('./package')

var SUB_USER_AGENT = pkg.name + '/' + pkg.version

var Client = module.exports = function (opts) {
  if (!(this instanceof Client)) return new Client(opts)

  opts = opts || {}

  if (!opts.appId || !opts.organizationId || !opts.secretToken || !opts.userAgent) {
    throw new Error('Missing required options: appId, organizationId, secretToken or userAgent')
  }

  this.appId = opts.appId
  this.organizationId = opts.organizationId
  this.secretToken = opts.secretToken
  this.userAgent = opts.userAgent + ' ' + SUB_USER_AGENT

  // opts._api* properties are used for debugging and testing
  this._api = {
    host: opts._apiHost || 'intake.opbeat.com',
    port: opts._apiPort,
    transport: opts._apiSecure !== false ? https : require('http'),
    path: '/api/v1/organizations/' + opts.organizationId + '/apps/' + opts.appId + '/'
  }
}

Client.prototype.request = function (endpoint, headers, body, cb) {
  var self = this

  if (typeof body === 'function') return this.request(endpoint, {}, headers, body)
  if (!headers) headers = {}

  zlib.deflate(stringify(body), function (err, buffer) {
    if (err) return cb(err)

    headers['Authorization'] = 'Bearer ' + self.secretToken
    headers['Content-Type'] = 'application/octet-stream' // yes this is weird!
    headers['Content-Length'] = buffer.length
    headers['User-Agent'] = self.userAgent

    var opts = {
      method: 'POST',
      hostname: self._api.host,
      port: self._api.port,
      path: self._api.path + endpoint + '/',
      headers: headers
    }

    var req = self._api.transport.request(opts, function (res) {
      var buffers = []
      res.on('data', buffers.push.bind(buffers))
      res.on('end', function () {
        cb(null, res, Buffer.concat(buffers).toString('utf8'))
      })
    })
    req.on('error', cb)
    req.end(buffer)
  })
}
