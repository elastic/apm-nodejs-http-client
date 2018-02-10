'use strict'

var zlib = require('zlib')
var http = require('http')
var https = require('https')
var test = require('tape')
var nock = require('nock')
var pem = require('https-pem')
var semver = require('semver')
var Client = require('./')

test('throw if missing required options', function (t) {
  t.throws(function () {
    Client()
  })
  t.end()
})

test('only userAgent should be required', function (t) {
  t.doesNotThrow(function () {
    Client({userAgent: 'foo'})
  })
  t.end()
})

test('#request()', function (t) {
  var encode = function (body, cb) {
    zlib.gzip(JSON.stringify(body), function (err, buffer) {
      if (err) throw err
      cb(buffer)
    })
  }
  var body = { foo: 'bar' }

  encode(body, function (buffer) {
    t.test('normal request', function (t) {
      var client = Client({secretToken: 'secret', userAgent: 'foo'})
      var scope = nock('http://localhost:8200')
        .matchHeader('Authorization', 'Bearer secret')
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Content-Encoding', 'gzip')
        .matchHeader('Content-Length', String(buffer.length))
        .matchHeader('User-Agent', 'foo elastic-apm-http-client/' + require('./package').version)
        .post('/v1/endpoint', function (body) {
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

    t.test('no secretToken', function (t) {
      var client = Client({userAgent: 'foo'})
      var scope = nock('http://localhost:8200')
        .post('/v1/endpoint', function (body, a, b) {
          t.ok('content-encoding' in this.headers)
          t.notOk('authorization' in this.headers)
          return true
        })
        .reply()

      client.request('endpoint', body, function (err, res, body) {
        t.error(err)
        scope.done()
        t.end()
      })
    })

    t.test('request with error', function (t) {
      var client = Client({userAgent: 'foo'})
      var scope = nock('http://localhost:8200')
        .post('/v1/endpoint', function (body) {
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
      var client = Client({userAgent: 'foo'})
      var scope = nock('http://localhost:8200')
        .matchHeader('X-Foo', 'bar')
        .post('/v1/endpoint', function (body) {
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
          secretToken: 'test',
          userAgent: 'test',
          serverUrl: 'http://localhost:' + server.address().port
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

    t.test('reject unauthorized TLS by default', function (t) {
      var server = https.createServer(pem, function (req, res) {
        res.end('secret')
      })

      server.listen(function () {
        var opts = {
          userAgent: 'test',
          serverUrl: 'https://localhost:' + server.address().port
        }

        var client = Client(opts)

        client.request('endpoint', body, function (err, res, body) {
          if (semver.gte(process.version, '0.12.0')) {
            t.equal(err.message, 'self signed certificate')
            t.equal(err.code, 'DEPTH_ZERO_SELF_SIGNED_CERT')
          } else {
            // Node.js v0.10 had the code as the message (and no code)
            t.equal(err.message, 'DEPTH_ZERO_SELF_SIGNED_CERT')
          }
          server.close()
          t.end()
        })
      })
    })

    t.test('allow unauthorized TLS by if asked', function (t) {
      var server = https.createServer(pem, function (req, res) {
        res.end('secret')
      })

      server.listen(function () {
        var opts = {
          userAgent: 'test',
          serverUrl: 'https://localhost:' + server.address().port,
          rejectUnauthorized: false
        }

        var client = Client(opts)

        client.request('endpoint', body, function (err, res, body) {
          t.error(err)
          t.equal(body, 'secret')
          server.close()
          t.end()
        })
      })
    })

    t.test('serverUrl contains path', function (t) {
      var client = Client({userAgent: 'foo', serverUrl: 'http://localhost:8200/sub'})
      var scope = nock('http://localhost:8200')
        .post('/sub/v1/endpoint')
        .reply()

      client.request('endpoint', body, function (err, res, body) {
        t.error(err)
        scope.done()
        t.end()
      })
    })

    t.test('socket timeout', function (t) {
      var client = Client({
        secretToken: 'secret',
        userAgent: 'foo',
        serverTimeout: 1000
      })

      var scope = nock('http://localhost:8200')
        .post('/v1/endpoint')
        .socketDelay(2000)
        .reply(200)

      client.request('endpoint', body, function (err, res, body) {
        t.ok(err)
        t.equal(err.code, 'ECONNRESET')
        scope.done()
        t.end()
      })
    })
  })
})
