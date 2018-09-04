'use strict'

const http = require('http')
const https = require('https')
const zlib = require('zlib')
const semver = require('semver')
const pem = require('https-pem')
const ndjson = require('ndjson')
const pkg = require('../../package')
const Client = require('../../')

exports.APMServer = APMServer
exports.processReq = processReq
exports.assertReq = assertReq
exports.assertMetadata = assertMetadata
exports.assertEvent = assertEvent
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
  t.equal(req.url, '/intake/v2/events', 'should send request to /intake/v2/events')
  t.equal(req.headers['authorization'], 'Bearer secret', 'should add secret token')
  t.equal(req.headers['content-type'], 'application/x-ndjson', 'should send reqeust as ndjson')
  t.equal(req.headers['content-encoding'], 'gzip', 'should compress request')
  t.equal(req.headers['accept'], 'application/json', 'should expect json in response')
  t.equal(req.headers['user-agent'], `my-user-agent ${pkg.name}/${pkg.version}`, 'should add proper User-Agent')
}
assertReq.asserts = 7

function assertMetadata (t, obj) {
  t.deepEqual(Object.keys(obj), ['metadata'], 'should receive metadata')
  const metadata = obj.metadata
  t.deepEqual(Object.keys(metadata), ['service', 'process', 'system'])
  const service = metadata.service
  t.equal(service.name, 'my-service-name')
  t.equal(service.runtime.name, 'node')
  t.equal(service.runtime.version, process.versions.node)
  t.ok(semver.valid(service.runtime.version))
  t.equal(service.language.name, 'javascript')
  t.equal(service.agent.name, 'my-agent-name')
  t.equal(service.agent.version, 'my-agent-version')
  const _process = metadata.process
  t.ok(_process.pid > 0)
  t.ok(_process.ppid > 0)

  if (_process.title.length === 1) {
    // because of truncation test
    t.equal(_process.title, process.title[0])
  } else {
    const regex = /(\/node|^node)$/
    t.ok(regex.test(_process.title), `process.title should match ${regex} (was: ${_process.title})`)
  }

  t.ok(Array.isArray(_process.argv), 'process.title should be an array')
  t.ok(_process.argv.length >= 2, 'process.title should contain at least two elements')
  t.ok(/\/node$/.test(_process.argv[0]), `process.argv[0] should match /\\/node$/ (was: ${_process.argv[0]})`)
  const regex = /(\/test\/(test|backoff|truncate|lib\/unref-client)\.js|node_modules\/\.bin\/tape)$/
  t.ok(regex.test(_process.argv[1]), `process.argv[1] should match ${regex} (was: ${_process.argv[1]})"`)
  const system = metadata.system
  t.ok(typeof system.hostname, 'string')
  t.ok(system.hostname.length > 0)
  t.ok(typeof system.architecture, 'string')
  t.ok(system.architecture.length > 0)
  t.ok(typeof system.platform, 'string')
  t.ok(system.platform.length > 0)
}
assertMetadata.asserts = 22

function assertEvent (expect) {
  return function (t, obj) {
    const key = Object.keys(expect)[0]
    const val = expect[key]
    switch (key) {
      case 'transaction':
        if (!('name' in val)) val.name = 'undefined'
        if (!('type' in val)) val.type = 'undefined'
        if (!('result' in val)) val.result = 'undefined'
        break
      case 'span':
        if (!('name' in val)) val.name = 'undefined'
        if (!('type' in val)) val.type = 'undefined'
        break
      case 'error':
        break
      default:
        t.fail('unexpected event type: ' + key)
    }
    t.deepEqual(obj, expect)
  }
}
assertEvent.asserts = 1

function validOpts (opts) {
  return Object.assign({
    agentName: 'my-agent-name',
    agentVersion: 'my-agent-version',
    serviceName: 'my-service-name',
    userAgent: 'my-user-agent'
  }, opts)
}
