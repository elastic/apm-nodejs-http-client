'use strict'

const path = require('path')
const exec = require('child_process').exec
const http = require('http')
const test = require('tape')
const semver = require('semver')
const utils = require('./utils')
const pkg = require('../package')
const Client = require('../')

const APMServer = utils.APMServer
const processReq = utils.processReq
const assertReq = utils.assertReq
const onmeta = utils.onmeta

/**
 * Setup and config
 */

test('package', function (t) {
  // these values are in the User-Agent header tests, so we need to make sure
  // they are as we expect
  t.equal(pkg.name, 'elastic-apm-http-client')
  t.ok(semver.valid(pkg.version))
  t.end()
})

test('throw if missing required options', function (t) {
  t.throws(function () {
    new Client() // eslint-disable-line no-new
  })
  t.end()
})

test('throw if only userAgent is provided', function (t) {
  t.throws(function () {
    new Client({userAgent: 'foo'}) // eslint-disable-line no-new
  })
  t.end()
})

test('throw if only meta is provided', function (t) {
  t.throws(function () {
    new Client({meta: onmeta}) // eslint-disable-line no-new
  })
  t.end()
})

test('only userAgent and meta should be required', function (t) {
  t.doesNotThrow(function () {
    new Client({ // eslint-disable-line no-new
      userAgent: 'foo',
      meta: onmeta
    })
  })
  t.end()
})

test('should work without new', function (t) {
  const client = Client({
    userAgent: 'foo',
    meta: onmeta
  })
  t.ok(client instanceof Client)
  t.end()
})

test('null value config options shouldn\'t throw', function (t) {
  t.doesNotThrow(function () {
    new Client({ // eslint-disable-line no-new
      userAgent: 'foo', // valid, so we don't throw
      meta: onmeta, // valid, so we don't throw
      size: null,
      time: null,
      serverTimeout: null,
      type: null,
      serverUrl: null,
      keepAlive: null
    })
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
    const client = new Client({
      serverUrl: 'http://localhost:' + server.address().port,
      userAgent: 'foo',
      meta: onmeta
    })
    client.writeSpan({foo: 42})
    client.end()
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
    const client = new Client({
      serverUrl: 'http://localhost:' + server.address().port,
      userAgent: 'foo',
      meta: onmeta,
      headers: {
        'X-Foo': 'bar'
      }
    })
    client.writeSpan({foo: 42})
    client.end()
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
    const client = new Client({
      serverUrl: 'http://localhost:' + server.address().port + '/subpath',
      userAgent: 'foo',
      meta: onmeta
    })
    client.writeSpan({foo: 42})
    client.end()
  })
})

test('reject unauthorized TLS by default', function (t) {
  t.plan(3)

  const server = APMServer({secure: true}, function (req, res) {
    t.fail('should should not get request')
  }).client(function (client) {
    client.writeSpan({foo: 42})
    client.end()
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
    t.pass('should let request through')
    res.end()
    server.close()
    t.end()
  }).client({rejectUnauthorized: false}, function (client) {
    client.writeSpan({foo: 42})
    client.end()
  })
})

/**
 * Normal operation
 */

const dataTypes = ['span', 'transaction', 'error']

dataTypes.forEach(function (dataType) {
  const writeFn = 'write' + dataType.charAt(0).toUpperCase() + dataType.substr(1)

  test(`client.${writeFn}() + client.flush()`, function (t) {
    t.plan(2 + assertReq.asserts)
    const datas = [
      {metadata: {}},
      {[dataType]: {foo: 42}}
    ]
    const server = APMServer(function (req, res) {
      assertReq(t, req)
      req = processReq(req)
      req.on('data', function (obj) {
        t.deepEqual(obj, datas.shift())
      })
      req.on('end', function () {
        res.end()
        server.close()
        t.end()
      })
    }).client(function (client) {
      client[writeFn]({foo: 42})
      client.flush()
    })
  })

  test(`client.${writeFn}() + client.end()`, function (t) {
    t.plan(2 + assertReq.asserts)
    const datas = [
      {metadata: {}},
      {[dataType]: {foo: 42}}
    ]
    const server = APMServer(function (req, res) {
      assertReq(t, req)
      req = processReq(req)
      req.on('data', function (obj) {
        t.deepEqual(obj, datas.shift())
      })
      req.on('end', function () {
        res.end()
        server.close()
        t.end()
      })
    }).client(function (client) {
      client[writeFn]({foo: 42})
      client.end()
    })
  })

  test(`single client.${writeFn}`, function (t) {
    t.plan(2 + assertReq.asserts)
    const datas = [
      {metadata: {}},
      {[dataType]: {foo: 42}}
    ]
    const server = APMServer(function (req, res) {
      assertReq(t, req)
      req = processReq(req)
      req.on('data', function (obj) {
        t.deepEqual(obj, datas.shift())
      })
      req.on('end', function () {
        res.end()
        server.close()
        t.end()
      })
    }).client({time: 100}, function (client) {
      client[writeFn]({foo: 42})
    })
  })

  test('multiple client.write (same request)', function (t) {
    t.plan(4 + assertReq.asserts)
    const datas = [
      {metadata: {}},
      {[dataType]: {req: 1}},
      {[dataType]: {req: 2}},
      {[dataType]: {req: 3}}
    ]
    const server = APMServer(function (req, res) {
      assertReq(t, req)
      req = processReq(req)
      req.on('data', function (obj) {
        t.deepEqual(obj, datas.shift())
      })
      req.on('end', function () {
        res.end()
        server.close()
        t.end()
      })
    }).client({time: 100}, function (client) {
      client[writeFn]({req: 1})
      client[writeFn]({req: 2})
      client[writeFn]({req: 3})
    })
  })

  test('multiple client.write (multiple requests)', function (t) {
    t.plan(8 + assertReq.asserts * 2)

    let clientReqNum = 0
    let clientWriteNum = 0
    let serverReqNum = 0
    let client

    const datas = [
      {metadata: {}},
      {[dataType]: {req: 1, write: 1}},
      {[dataType]: {req: 1, write: 2}},
      {[dataType]: {req: 1, write: 3}},
      {metadata: {}},
      {[dataType]: {req: 2, write: 4}},
      {[dataType]: {req: 2, write: 5}},
      {[dataType]: {req: 2, write: 6}}
    ]

    const server = APMServer(function (req, res) {
      let reqNum = ++serverReqNum
      assertReq(t, req)
      req = processReq(req)
      req.on('data', function (obj) {
        t.deepEqual(obj, datas.shift())
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
    }).client({time: 100}, function (_client) {
      client = _client
      write()
    })

    function write () {
      clientReqNum++
      for (let n = 0; n < 3; n++) {
        client[writeFn]({req: clientReqNum, write: ++clientWriteNum})
      }
    }
  })
})

/**
 * Side effects
 */

test('client should not hold the process open', function (t) {
  t.plan(3 + assertReq.asserts)

  const datas = [
    {metadata: {}},
    {span: {hello: 'world'}}
  ]

  const server = APMServer(function (req, res) {
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, datas.shift())
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
      t.ok(duration < 300, `should not take more than 300 ms to complete (was: ${duration})`)
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
  }).client(function (client) {
    client.writeSpan({foo: 42})
    client.flush()
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
  }).client(function (client) {
    client.writeSpan({foo: 42})
    client.flush()
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
  }).client(function (client) {
    client.writeSpan({foo: 42})
    client.flush()
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
  }).client(function (client) {
    client.writeSpan({foo: 42})
    client.flush()
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
  }).client(function (client) {
    client.writeSpan({foo: 42})
    client.flush()
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
  }).client(function (client) {
    client.writeSpan({foo: 42})
  }, function (err) {
    t.equal(err.message, 'socket hang up')
    t.equal(err.code, 'ECONNRESET')
    server.close()
    t.end()
  })
})

test('socket hang up - continue with new request', function (t) {
  t.plan(5 + assertReq.asserts * 2)
  let reqs = 0
  let client
  const datas = [
    {metadata: {}},
    {span: {req: 2}}
  ]
  const server = APMServer(function (req, res) {
    assertReq(t, req)

    if (++reqs === 1) return req.socket.destroy()

    // We have to attach the listener directly to the HTTP request stream as it
    // will receive the gzip header once the write have been made on the
    // client. If we were to attach it to the gunzip+ndjson, it would not fire
    req.on('data', function () {
      client.end()
    })

    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, datas.shift())
    })
    req.on('end', function () {
      t.pass('should end request')
      res.end()
      server.close()
      t.end()
    })
  }).client(function (_client) {
    client = _client
    client.writeSpan({req: 1})
  }, function (err) {
    t.equal(err.message, 'socket hang up')
    t.equal(err.code, 'ECONNRESET')
    client.writeSpan({req: 2})
  })
})

test('socket timeout - server response too slow', function (t) {
  let start
  const server = APMServer(function (req, res) {
    req.resume()
  }).client({serverTimeout: 1000}, function (client) {
    start = Date.now()
    client.writeSpan({foo: 42})
    client.end()
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
  let start
  const server = APMServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
    })
  }).client({serverTimeout: 1000}, function (client) {
    start = Date.now()
    client.writeSpan({foo: 42})
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

test('client.destroy() - on fresh client', function (t) {
  const client = new Client({
    userAgent: 'foo',
    meta: onmeta
  })
  client.destroy()
  t.end()
})

test('client.destroy() - on ended client', function (t) {
  let client

  // create a server that doesn't unref incoming sockets to see if
  // `client.destroy()` will make the server close without hanging
  const server = http.createServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
      client.destroy()
      server.close()
      t.end()
    })
  })

  server.listen(function () {
    client = new Client({
      serverUrl: 'http://localhost:' + server.address().port,
      userAgent: 'foo',
      meta: onmeta
    })
    client.writeSpan({foo: 42})
    client.end()
  })
})

test('client.destroy() - on client with request in progress', function (t) {
  let client

  // create a server that doesn't unref incoming sockets to see if
  // `client.destroy()` will make the server close without hanging
  const server = http.createServer(function (req, res) {
    server.close()
    client.destroy()
    t.end()
  })

  server.listen(function () {
    client = new Client({
      serverUrl: 'http://localhost:' + server.address().port,
      userAgent: 'foo',
      meta: onmeta
    })
    client.writeSpan({foo: 42})
  })
})
