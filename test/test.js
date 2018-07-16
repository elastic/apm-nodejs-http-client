'use strict'

const path = require('path')
const exec = require('child_process').exec
const test = require('tape')
const semver = require('semver')
const utils = require('./utils')
const pkg = require('../package')
const Client = require('../')

const APMServer = utils.APMServer
const processReq = utils.processReq
const assertReq = utils.assertReq

/**
 * Setup and config
 */

test('package', function (t) {
  t.equal(pkg.name, 'elastic-apm-http-client')
  t.ok(semver.valid(pkg.version))
  t.end()
})

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

test('no secretToken', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    t.notOk('authorization' in req.headers)
    res.end()
    server.close()
    t.end()
  })
  server.listen(function () {
    Client({
      serverUrl: 'http://localhost:' + server.address().port,
      userAgent: 'foo'
    }).end({foo: 42})
  })
})

test('custom headers', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    t.equal(req.headers['x-foo'], 'bar')
    res.end()
    server.close()
    t.end()
  }).listen(function () {
    Client({
      serverUrl: 'http://localhost:' + server.address().port,
      userAgent: 'foo',
      headers: {
        'X-Foo': 'bar'
      }
    }).end({foo: 42})
  })
})

test('serverUrl contains path', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    t.equal(req.url, '/subpath/v2/intake')
    res.end()
    server.close()
    t.end()
  }).listen(function () {
    Client({
      serverUrl: 'http://localhost:' + server.address().port + '/subpath',
      userAgent: 'foo'
    }).end({foo: 42})
  })
})

test('reject unauthorized TLS by default', function (t) {
  t.plan(3)

  const server = APMServer({secure: true}, function (req, res) {
    t.fail('should should not get request')
  }).client(function (stream) {
    stream.end({foo: 42})
  }, function (err) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'self signed certificate')
    t.equal(err.code, 'DEPTH_ZERO_SELF_SIGNED_CERT')
    server.close()
    t.end()
  })
})

test('allow unauthorized TLS if asked', function (t) {
  t.plan(1)
  const server = APMServer({secure: true}, function (req, res) {
    t.ok(true, 'should let request through')
    res.end()
    server.close()
    t.end()
  }).client({rejectUnauthorized: false}, function (stream) {
    stream.end({foo: 42})
  })
})

/**
 * Normal operation
 */

test('stream.end(data)', function (t) {
  t.plan(1 + assertReq.asserts)
  const server = APMServer(function (req, res) {
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {foo: 42})
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (stream) {
    stream.end({foo: 42})
  })
})

test('stream.write(data) + stream.end()', function (t) {
  t.plan(1 + assertReq.asserts)
  const server = APMServer(function (req, res) {
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {foo: 42})
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (stream) {
    stream.write({foo: 42})
    stream.end()
  })
})

test('single stream.write', function (t) {
  t.plan(1 + assertReq.asserts)
  const server = APMServer(function (req, res) {
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {foo: 42})
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({time: 100}, function (stream) {
    stream.write({foo: 42})
  })
})

test('multiple stream.write (same request)', function (t) {
  t.plan(3 + assertReq.asserts)
  const server = APMServer(function (req, res) {
    let counter = 0
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {req: ++counter})
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({time: 100}, function (stream) {
    stream.write({req: 1})
    stream.write({req: 2})
    stream.write({req: 3})
  })
})

test('multiple stream.write (multiple requests)', function (t) {
  t.plan(6 + assertReq.asserts * 2)

  let clientReqNum = 0
  let clientWriteNum = 0
  let serverReqNum = 0
  let serverDataNum = 0
  let stream

  const server = APMServer(function (req, res) {
    let reqNum = ++serverReqNum
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {req: reqNum, write: ++serverDataNum})
    })
    req.on('end', function () {
      res.end()
      if (reqNum === 1) {
        write()
      } else {
        server.close()
        t.end()
      }
    })
  }).client({time: 100}, function (_stream) {
    stream = _stream
    write()
  })

  function write () {
    clientReqNum++
    for (let n = 0; n < 3; n++) {
      stream.write({req: clientReqNum, write: ++clientWriteNum})
    }
  }
})

/**
 * Side effects
 */

test('client should not hold the process open', function (t) {
  t.plan(2 + assertReq.asserts)

  const server = APMServer(function (req, res) {
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {hello: 'world'}, 'should get data from client')
    })
    req.on('end', function () {
      res.statusCode = 202
      res.end()
      server.close()
    })
  })

  server.listen(function () {
    const url = 'http://localhost:' + server.address().port
    const file = path.join(__dirname, 'unref-client.js')
    exec(`node ${file} ${url}`, function (err, stdout, stderr) {
      if (err) throw err
      const end = Date.now()
      const start = Number(stdout)
      const duration = end - start
      t.ok(duration < 200, 'should not take more than 200 ms to complete')
      t.end()
    })
  })
})

/**
 * Edge cases
 */

test('request with error - no body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.end()
  }).client(function (stream) {
    stream.end({foo: 42})
  }, function (err) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'Unexpected response code from APM Server: 418')
    t.equal(err.result, undefined)
    server.close()
    t.end()
  })
})

test('request with error - non json body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.end('boom!')
  }).client(function (stream) {
    stream.end({foo: 42})
  }, function (err) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'Unexpected response code from APM Server: 418')
    t.equal(err.result, 'boom!')
    server.close()
    t.end()
  })
})

test('request with error - invalid json body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end('boom!')
  }).client(function (stream) {
    stream.end({foo: 42})
  }, function (err) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'Unexpected response code from APM Server: 418')
    t.equal(err.result, 'boom!')
    server.close()
    t.end()
  })
})

test('request with error - json body without error property', function (t) {
  const body = JSON.stringify({foo: 'bar'})
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end(body)
  }).client(function (stream) {
    stream.end({foo: 42})
  }, function (err) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'Unexpected response code from APM Server: 418')
    t.equal(err.result, body)
    server.close()
    t.end()
  })
})

test('request with error - json body with error property', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({error: 'bar'}))
  }).client(function (stream) {
    stream.end({foo: 42})
  }, function (err) {
    t.ok(err instanceof Error)
    t.equal(err.message, 'Unexpected response code from APM Server: 418')
    t.equal(err.result, 'bar')
    server.close()
    t.end()
  })
})

test('socket hang up', function (t) {
  const server = APMServer(function (req, res) {
    req.socket.destroy()
  }).client(function (stream) {
    stream.write({foo: 42})
  }, function (err) {
    t.equal(err.message, 'socket hang up')
    t.equal(err.code, 'ECONNRESET')
    server.close()
    t.end()
  })
})

test('socket hang up - continue with new request', function (t) {
  t.plan(4 + assertReq.asserts * 2)
  let reqs = 0
  let stream
  const server = APMServer(function (req, res) {
    assertReq(t, req)

    if (++reqs === 1) return req.socket.destroy()

    // We have to attach the listener directly to the HTTP request stream as it
    // will receive the gzip header once the write have been made on the
    // client. If we were to attach it to the gunzip+ndjson, it would not fire
    req.on('data', function () {
      stream.end()
    })

    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, {req: 2}, 'should get data')
    })
    req.on('end', function () {
      t.ok(true, 'should end request')
      res.end()
      server.close()
      t.end()
    })
  }).client(function (_stream) {
    stream = _stream
    stream.write({req: 1})
  }, function (err) {
    t.equal(err.message, 'socket hang up')
    t.equal(err.code, 'ECONNRESET')
    stream.write({req: 2})
  })
})

test('socket timeout - server response too slow', function (t) {
  let start
  const server = APMServer(function (req, res) {
    req.resume()
  }).client({serverTimeout: 1000}, function (stream) {
    start = Date.now()
    stream.end({foo: 42})
  }, function (err) {
    const end = Date.now()
    const delta = end - start
    t.ok(delta > 1000 && delta < 2000, 'timeout should occur between 1-2 seconds')
    t.equal(err.message, 'socket hang up')
    t.equal(err.code, 'ECONNRESET')
    server.close()
    t.end()
  })
})

test('socket timeout - client request too slow', function (t) {
  let count = 0
  let start
  const server = APMServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
    })
  }).client({serverTimeout: 1000}, function (stream) {
    start = Date.now()
    stream.write({foo: 42})
  }, function (err) {
    count++
    if (count === 1) {
      const end = Date.now()
      const delta = end - start
      t.ok(delta > 1000 && delta < 2000, 'timeout should occur between 1-2 seconds')
      t.equal(err.message, 'premature close')
      t.equal(err.code, undefined)
    } else if (count === 2) {
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      server.close()
      t.end()
    } else {
      t.fail('too many errors')
    }
  })
})
