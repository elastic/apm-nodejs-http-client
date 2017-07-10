'use strict'

var zlib = require('zlib')
var http = require('http')
var test = require('tape')
var nock = require('nock')
var Client = require('./')

var options = {
  secretToken: 'secret',
  userAgent: 'foo'
}

test('throw if missing required options', function (t) {
  t.throws(function () {
    Client()
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
      var client = Client(options)
      var scope = nock('http://localhost:8080')
        .matchHeader('Authorization', 'Bearer ' + options.secretToken)
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Content-Encoding', 'gzip')
        .matchHeader('Content-Length', String(buffer.length))
        .matchHeader('User-Agent', 'foo elastic-apm-http-client/' + require('./package').version)
        .post('/endpoint', function (body) {
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
      var scope = nock('http://localhost:8080')
        .post('/endpoint', function (body) {
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
      var scope = nock('http://localhost:8080')
        .matchHeader('X-Foo', 'bar')
        .post('/endpoint', function (body) {
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
          apiPort: server.address().port
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
