'use strict'

const http = require('http')
const https = require('https')
const zlib = require('zlib')
const semver = require('semver')
const pem = require('https-pem')
const ndjson = require('ndjson')
const pkg = require('../package')
const Client = require('../')

exports.APMServer = APMServer
exports.processReq = processReq
exports.assertReq = assertReq
exports.assertMetadata = assertMetadata
exports.validOpts = validOpts

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

  server.client = function (opts, onclient) {
    if (typeof opts === 'function') {
      onclient = opts
      opts = {}
    }
    server.listen(function () {
      onclient(new Client(validOpts(Object.assign({
        serverUrl: `http${secure ? 's' : ''}://localhost:${server.address().port}`,
        secretToken: 'secret'
      }, opts))))
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
  t.equal(req.headers['user-agent'], `my-user-agent ${pkg.name}/${pkg.version}`, 'should add proper User-Agent')
}
assertReq.asserts = 7

function assertMetadata (t, obj) {
  t.deepEqual(Object.keys(obj), ['metadata'])
  const metadata = obj.metadata
  t.deepEqual(Object.keys(metadata), ['service', 'process', 'system'])
  const service = metadata.service
  t.equal(service.name, 'my-service-name')
  t.equal(service.runtime.name, 'node')
  t.equal(service.runtime.version, process.version)
  t.ok(semver.valid(service.runtime.version))
  t.equal(service.language.name, 'javascript')
  t.equal(service.agent.name, 'my-agent-name')
  t.equal(service.agent.version, 'my-agent-version')
  const _process = metadata.process
  t.ok(_process.pid > 0)
  t.ok(_process.ppid > 0)
  t.ok(/(\/node|^node)$/.test(_process.title), `process.title should match /(\\/node|^node)$/ (was: ${_process.title})`)
  t.ok(Array.isArray(_process.argv), 'process.title should be an array')
  t.ok(_process.argv.length >= 2, 'process.title should contain at least two elements')
  t.ok(/\/node$/.test(_process.argv[0]), `process.argv[0] should match /\\/node$/ (was: ${_process.argv[0]})`)
  t.ok(/\/test\/(test|unref-client)\.js$/.test(_process.argv[1]), `process.argv[1] should match /\\/test\\/(test|unref-client)\\.js$/ (was: ${_process.argv[1]})"`)
  const system = metadata.system
  t.ok(typeof system.hostname, 'string')
  t.ok(system.hostname.length > 0)
  t.ok(typeof system.architecture, 'string')
  t.ok(system.architecture.length > 0)
  t.ok(typeof system.platform, 'string')
  t.ok(system.platform.length > 0)
}
assertMetadata.asserts = 22

function validOpts (opts) {
  return Object.assign({
    agentName: 'my-agent-name',
    agentVersion: 'my-agent-version',
    serviceName: 'my-service-name',
    userAgent: 'my-user-agent'
  }, opts)
}
