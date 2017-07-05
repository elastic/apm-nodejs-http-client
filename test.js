'use strict'

var zlib = require('zlib')
var http = require('http')
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
        .post('/api/v1/organizations/some-org-id/apps/some-app-id/endpoint/', function (body) {
          t.equal(body, buffer.toString('hex'))
          return true
        })
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
        .post('/api/v1/organizations/some-org-id/apps/some-app-id/endpoint/', function (body) {
          t.equal(body, buffer.toString('hex'))
          return true
        })
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
        .post('/api/v1/organizations/some-org-id/apps/some-app-id/endpoint/', function (body) {
          t.equal(body, buffer.toString('hex'))
          return true
        })
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

    t.test('socket hang up', function (t) {
      var server = http.createServer(function (req, res) {
        req.socket.destroy()
      })

      server.listen(function () {
        var opts = {
          organizationId: 'test',
          appId: 'test',
          secretToken: 'test',
          userAgent: 'test',
          _apiHost: 'localhost',
          _apiPort: server.address().port,
          _apiSecure: false
        }

        var client = Client(opts)

        client.request('endpoint', body, function (err, res, body) {
          t.equal(err.message, 'socket hang up')
          t.equal(err.code, 'ECONNRESET')
          server.close()
          t.end()
        })
      })
    })
  })
})