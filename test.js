'use strict'

var zlib = require('zlib')
var test = require('tape')
var nock = require('nock')
var Client = require('./')

var options = {
  organizationId: 'some-org-id',
  appId: 'some-app-id',
  secretToken: 'secret',
  userAgent: 'foo'
}

test('throw if missing required options', function (t) {
  var fn = function () {
    Client({ appId: 'foo', organizationId: 'bar' })
  }
  t.throws(fn)
  t.end()
})

test('#request()', function (t) {
  var encode = function (body, cb) {
    zlib.deflate(JSON.stringify(body), function (err, buffer) {
      if (err) throw err
      cb(buffer)
    })
  }
  var body = { foo: 'bar' }

  encode(body, function (buffer) {
    t.test('normal request', function (t) {
      var client = Client(options)
      var scope = nock('https://intake.opbeat.com')
        .matchHeader('Authorization', 'Bearer ' + options.secretToken)
        .matchHeader('Content-Type', 'application/octet-stream')
        .matchHeader('Content-Length', buffer.length)
        .matchHeader('User-Agent', 'foo opbeat-http-client/' + require('./package').version)
        .filteringRequestBody(function (body) {
          t.equal(body, buffer.toString('hex'))
          return 'ok'
        })
        .post('/api/v1/organizations/some-org-id/apps/some-app-id/endpoint/', 'ok')
        .reply(202)

      client.request('endpoint', body, function (err, res, body) {
        t.error(err)
        t.equal(res.statusCode, 202)
        t.equal(body, '')
        scope.done()
        t.end()
      })
    })

    t.test('request with error', function (t) {
      var client = Client(options)
      var scope = nock('https://intake.opbeat.com')
        .filteringRequestBody(function (body) {
          t.equal(body, buffer.toString('hex'))
          return 'ok'
        })
        .post('/api/v1/organizations/some-org-id/apps/some-app-id/endpoint/', 'ok')
        .reply(500, { error: 'foo' })

      client.request('endpoint', body, function (err, res, body) {
        t.error(err)
        t.equal(res.statusCode, 500)
        t.deepEqual(body, '{"error":"foo"}')
        scope.done()
        t.end()
      })
    })

    t.test('with custom header', function (t) {
      var client = Client(options)
      var scope = nock('https://intake.opbeat.com')
        .matchHeader('X-Foo', 'bar')
        .filteringRequestBody(function (body) {
          t.equal(body, buffer.toString('hex'))
          return 'ok'
        })
        .post('/api/v1/organizations/some-org-id/apps/some-app-id/endpoint/', 'ok')
        .reply(202)

      var headers = { 'X-Foo': 'bar' }

      client.request('endpoint', headers, body, function (err, res, body) {
        t.error(err)
        t.equal(res.statusCode, 202)
        t.equal(body, '')
        scope.done()
        t.end()
      })
    })
  })
})
