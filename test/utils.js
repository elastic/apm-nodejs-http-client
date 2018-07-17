'use strict'

const http = require('http')
const https = require('https')
const zlib = require('zlib')
const pem = require('https-pem')
const ndjson = require('ndjson')
const pkg = require('../package')
const Client = require('../')

exports.APMServer = APMServer
exports.processReq = processReq
exports.assertReq = assertReq
exports.onmeta = onmeta

function APMServer (opts, onreq) {
  if (typeof opts === 'function') return APMServer(null, opts)
  opts = opts || {}

  const secure = !!opts.secure

  const server = secure
    ? https.createServer(pem, onreq)
    : http.createServer(onreq)

  // Because we use a keep-alive agent in the client, we need to unref the
  // sockets received by the server. If not, the server would hold open the app
  // even after the tests have completed
  server.on('connection', function (socket) {
    socket.unref()
  })

  server.client = function (opts, onclient, onerror) {
    if (typeof opts === 'function') {
      onerror = onclient
      onclient = opts
      opts = {}
    }
    server.listen(function () {
      const stream = Client(Object.assign({
        serverUrl: `http${secure ? 's' : ''}://localhost:${server.address().port}`,
        secretToken: 'secret',
        userAgent: 'foo',
        meta: onmeta
      }, opts), onerror)
      onclient(stream)
    })
    return server
  }

  return server
}

function processReq (req) {
  return req.pipe(zlib.createGunzip()).pipe(ndjson.parse())
}

function assertReq (t, req) {
  t.equal(req.method, 'POST', 'should make a POST request')
  t.equal(req.url, '/v2/intake', 'should send request to /v2/intake')
  t.equal(req.headers['authorization'], 'Bearer secret', 'should add secret token')
  t.equal(req.headers['content-type'], 'application/x-ndjson', 'should send reqeust as ndjson')
  t.equal(req.headers['content-encoding'], 'gzip', 'should compress request')
  t.equal(req.headers['accept'], 'application/json', 'should expect json in response')
  t.equal(req.headers['user-agent'], `foo ${pkg.name}/${pkg.version}`, 'should add proper User-Agent')
}
assertReq.asserts = 7

function onmeta () {
  return {}
}
