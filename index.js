'use strict'

var https = require('https')
var zlib = require('zlib')
var stringify = require('json-stringify-safe')

var Client = module.exports = function (opts) {
  if (!(this instanceof Client)) return new Client(opts)

  opts = opts || {}
  this.appId = opts.appId
  this.organizationId = opts.organizationId
  this.secretToken = opts.secretToken
  this.userAgent = opts.userAgent
  this._api = {
    host: opts._apiHost || 'intake.opbeat.com',
    path: '/api/v1/organizations/' + opts.organizationId + '/apps/' + opts.appId + '/'
  }

  if (!this.appId || !this.organizationId || !this.secretToken || !this.userAgent) {
    throw new Error('Missing required options: appId, organizationId, secretToken or userAgent')
  }
}

Client.prototype.request = function (endpoint, body, cb) {
  var self = this
  zlib.deflate(stringify(body), function (err, buffer) {
    if (err) return cb(err)
    var opts = {
      method: 'POST',
      hostname: self._api.host,
      path: self._api.path + endpoint + '/',
      headers: {
        'Authorization': 'Bearer ' + self.secretToken,
        'Content-Type': 'application/octet-stream', // yes this is weird!
        'Content-Length': buffer.length,
        'User-Agent': self.userAgent
      }
    }
    var req = https.request(opts, function (res) {
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
