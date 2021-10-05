'use strict'

const test = require('tape')

const { APMServer, validOpts, assertConfigReq } = require('./lib/utils')
const Client = require('../')

test('central config disabled', function (t) {
  const origPollConfig = Client.prototype._pollConfig
  Client.prototype._pollConfig = function () {
    t.fail('should not call _pollConfig')
  }

  t.on('end', function () {
    Client.prototype._pollConfig = origPollConfig
  })

  Client(validOpts())
  t.end()
})

test('central config enabled', function (t) {
  t.plan(1)

  const origPollConfig = Client.prototype._pollConfig
  Client.prototype._pollConfig = function () {
    t.pass('should call _pollConfig')
  }

  t.on('end', function () {
    Client.prototype._pollConfig = origPollConfig
  })

  Client(validOpts({ centralConfig: true }))
  t.end()
})

// Test central-config handling of Etag and If-None-Match headers using a mock
// apm-server that uses the `Cache-Control: max-age=1 ...` header to speed up
// the polling interval of the client.
test('polling', function (t) {
  t.plan((assertConfigReq.asserts + 1) * 8 + 12)

  const expectedConf = { foo: 'bar' }
  const headers = { 'Cache-Control': 'max-age=1, must-revalidate' }
  let reqs = 0
  let client

  const server = APMServer(function (req, res) {
    assertConfigReq(t, req)

    switch (++reqs) {
      case 1:
        t.ok(!('if-none-match' in req.headers), 'should not have If-None-Match header')
        res.writeHead(500, Object.assign({ 'Content-Type': 'application/json' }, headers))
        res.end('{"invalid JSON"}')
        break
      case 2:
        t.ok(!('if-none-match' in req.headers), 'should not have If-None-Match header')
        res.writeHead(503, Object.assign({ 'Content-Type': 'application/json' }, headers))
        res.end(JSON.stringify('valid JSON'))
        break
      case 3:
        t.ok(!('if-none-match' in req.headers), 'should not have If-None-Match header')
        res.writeHead(503, Object.assign({ 'Content-Type': 'application/json' }, headers))
        res.end(JSON.stringify({ error: 'from error property' }))
        break
      case 4:
        t.ok(!('if-none-match' in req.headers), 'should not have If-None-Match header')
        res.writeHead(403, headers)
        res.end()
        break
      case 5:
        t.ok(!('if-none-match' in req.headers), 'should not have If-None-Match header')
        res.writeHead(404, headers)
        res.end()
        break
      case 6:
        t.ok(!('if-none-match' in req.headers), 'should not have If-None-Match header')
        res.writeHead(200, Object.assign({ Etag: '"42"' }, headers))
        res.end(JSON.stringify(expectedConf))
        break
      case 7:
        t.equal(req.headers['if-none-match'], '"42"')
        res.writeHead(304, Object.assign({ Etag: '"42"' }, headers))
        res.end()
        break
      case 8:
        // Hard shutdown on request #8 to end the test.
        // If the client's keep-alive agent has an open socket, this will
        // result in a "socket hang up" observed on the client side.
        res.writeHead(404)
        res.end()
        client.destroy()
        server.close(function () {
          t.end()
        })
        break
      default:
        t.fail('too many request')
    }
  }).client({ centralConfig: true }, function (_client) {
    client = _client
    client.on('config', function (conf) {
      t.equal(reqs, 6, 'should emit config after 6th request')
      t.deepEqual(conf, expectedConf)
    })
    client.on('request-error', function (err) {
      if (reqs === 1) {
        t.equal(err.code, 500)
        t.equal(err.message, 'Unexpected APM Server response when polling config')
        t.equal(err.response, '{"invalid JSON"}')
      } else if (reqs === 2) {
        t.equal(err.code, 503)
        t.equal(err.message, 'Unexpected APM Server response when polling config')
        t.equal(err.response, 'valid JSON')
      } else if (reqs === 3) {
        t.equal(err.code, 503)
        t.equal(err.message, 'Unexpected APM Server response when polling config')
        t.equal(err.response, 'from error property')
      } else if (reqs === 8) {
        // The mock APMServer above hard-destroys the connection on req 8. If
        // the client's keep-alive agent has an open socket, we expect a
        // "socket hang up" error here.
        t.ok(err, 'got an err, as expected, on req 8')
        t.equal(err.message, 'socket hang up')
      } else {
        t.error(err, 'got an err on req ' + reqs + ', err=' + err.message)
      }
    })
  })
})
