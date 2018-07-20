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
    client.sendSpan({foo: 42})
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
    client.sendSpan({foo: 42})
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
    client.sendSpan({foo: 42})
    client.end()
  })
})

test('reject unauthorized TLS by default', function (t) {
  t.plan(3)
  const server = APMServer({secure: true}, function (req, res) {
    t.fail('should should not get request')
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'self signed certificate')
      t.equal(err.code, 'DEPTH_ZERO_SELF_SIGNED_CERT')
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.end()
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
    client.sendSpan({foo: 42})
    client.end()
  })
})

/**
 * Normal operation
 */

const dataTypes = ['span', 'transaction', 'error']

dataTypes.forEach(function (dataType) {
  const sendFn = 'send' + dataType.charAt(0).toUpperCase() + dataType.substr(1)

  test(`client.${sendFn}() + client.flush()`, function (t) {
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
      client[sendFn]({foo: 42})
      client.flush()
    })
  })

  test(`client.${sendFn}(callback) + client.flush()`, function (t) {
    t.plan(3 + assertReq.asserts)
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
      let nexttick = false
      client[sendFn]({foo: 42}, function () {
        t.ok(nexttick, 'should call callback')
      })
      client.flush()
      nexttick = true
    })
  })

  test(`client.${sendFn}() + client.end()`, function (t) {
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
      client[sendFn]({foo: 42})
      client.end()
    })
  })

  test(`single client.${sendFn}`, function (t) {
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
      client[sendFn]({foo: 42})
    })
  })

  test(`multiple client.${sendFn} (same request)`, function (t) {
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
      client[sendFn]({req: 1})
      client[sendFn]({req: 2})
      client[sendFn]({req: 3})
    })
  })

  test(`multiple client.${sendFn} (multiple requests)`, function (t) {
    t.plan(8 + assertReq.asserts * 2)

    let clientReqNum = 0
    let clientSendNum = 0
    let serverReqNum = 0
    let client

    const datas = [
      {metadata: {}},
      {[dataType]: {req: 1, send: 1}},
      {[dataType]: {req: 1, send: 2}},
      {[dataType]: {req: 1, send: 3}},
      {metadata: {}},
      {[dataType]: {req: 2, send: 4}},
      {[dataType]: {req: 2, send: 5}},
      {[dataType]: {req: 2, send: 6}}
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
          send()
        } else {
          server.close()
          t.end()
        }
      })
    }).client({time: 100}, function (_client) {
      client = _client
      send()
    })

    function send () {
      clientReqNum++
      for (let n = 0; n < 3; n++) {
        client[sendFn]({req: clientReqNum, send: ++clientSendNum})
      }
    }
  })
})

test('client.flush(callback) - with active request', function (t) {
  t.plan(5 + assertReq.asserts)
  const datas = [
    {metadata: {}},
    {span: {foo: 42}}
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
    t.equal(client._active, false, 'no outgoing HTTP request to begin with')
    client.sendSpan({foo: 42})
    t.equal(client._active, true, 'an outgoing HTTP request should be active')
    client.flush(function () {
      t.equal(client._active, false, 'the outgoing HTTP request should be done')
    })
  })
})

test('client.flush(callback) - with queued request', function (t) {
  t.plan(6 + assertReq.asserts * 2)
  let requests = 0
  const datas = [
    {metadata: {}},
    {span: {req: 1}},
    {metadata: {}},
    {span: {req: 2}}
  ]
  const server = APMServer(function (req, res) {
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, datas.shift())
    })
    req.on('end', function () {
      res.end()
      if (++requests === 2) {
        t.end()
        server.close()
      }
    })
  }).client(function (client) {
    client.sendSpan({req: 1})
    client.flush()
    client.sendSpan({req: 2})
    t.equal(client._active, true, 'an outgoing HTTP request should be active')
    client.flush(function () {
      t.equal(client._active, false, 'the outgoing HTTP request should be done')
    })
  })
})

test('2nd flush before 1st flush have finished', function (t) {
  t.plan(6 + assertReq.asserts * 2)
  let requestStarts = 0
  let requestEnds = 0
  const datas = [
    {metadata: {}},
    {span: {req: 1}},
    {metadata: {}},
    {span: {req: 2}}
  ]
  const server = APMServer(function (req, res) {
    requestStarts++
    assertReq(t, req)
    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, datas.shift())
    })
    req.on('end', function () {
      requestEnds++
      res.end()
    })
  }).client(function (client) {
    client.sendSpan({req: 1})
    client.flush()
    client.sendSpan({req: 2})
    client.flush()
    setTimeout(function () {
      t.equal(requestStarts, 2, 'should have received 2 requests')
      t.equal(requestEnds, 2, 'should have received 2 requests completely')
      t.end()
      server.close()
    }, 100)
  })
})

test('client.end(callback)', function (t) {
  t.plan(3 + assertReq.asserts)
  const datas = [
    {metadata: {}},
    {span: {foo: 42}}
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
    client.sendSpan({foo: 42})
    client.end(function () {
      t.pass('should call callback')
    })
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

test.skip('write after end', function (t) {
  t.plan(2)
  const server = APMServer(function (req, res) {
    t.fail('should never get any request')
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'write after end')
      server.close()
      t.end()
    })
    client.end()
    client.sendSpan({foo: 42})
  })
})

test('request with error - no body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.end()
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected response code from APM Server: 418')
      t.equal(err.result, undefined)
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.flush()
  })
})

test('request with error - non json body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.end('boom!')
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected response code from APM Server: 418')
      t.equal(err.result, 'boom!')
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.flush()
  })
})

test('request with error - invalid json body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end('boom!')
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected response code from APM Server: 418')
      t.equal(err.result, 'boom!')
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.flush()
  })
})

test('request with error - json body without error property', function (t) {
  const body = JSON.stringify({foo: 'bar'})
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end(body)
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected response code from APM Server: 418')
      t.equal(err.result, body)
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.flush()
  })
})

test('request with error - json body with error property', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({error: 'bar'}))
  }).client(function (client) {
    client.on('warning', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected response code from APM Server: 418')
      t.equal(err.result, 'bar')
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.flush()
  })
})

test('socket hang up', function (t) {
  const server = APMServer(function (req, res) {
    req.socket.destroy()
  }).client(function (client) {
    client.on('warning', function (err) {
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      server.close()
      client.destroy()
      t.end()
    })
    client.on('finish', function () {
      t.fail('should not emit finish')
    })
    client.sendSpan({foo: 42})
  })
})

test('socket hang up - continue with new request', function (t) {
  t.plan(6 + assertReq.asserts * 2)
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
      client.flush()
    })

    req = processReq(req)
    req.on('data', function (obj) {
      t.deepEqual(obj, datas.shift())
    })
    req.on('end', function () {
      t.pass('should end request')
      res.end()
      server.close()
    })
  }).client(function (_client) {
    client = _client
    client.on('warning', function (err) {
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      client.sendSpan({req: 2})
    })
    client.on('finish', function () {
      t.equal(reqs, 2, 'should emit finish after last request')
      t.end()
    })
    client.sendSpan({req: 1})
  })
})

test('socket timeout - server response too slow', function (t) {
  const server = APMServer(function (req, res) {
    req.resume()
  }).client({serverTimeout: 1000}, function (client) {
    const start = Date.now()
    client.on('warning', function (err) {
      const end = Date.now()
      const delta = end - start
      t.ok(delta > 1000 && delta < 2000, 'timeout should occur between 1-2 seconds')
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
    client.end()
  })
})

test('socket timeout - client request too slow', function (t) {
  const server = APMServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
    })
  }).client({serverTimeout: 1000}, function (client) {
    const start = Date.now()
    client.on('warning', function (err) {
      const end = Date.now()
      const delta = end - start
      t.ok(delta > 1000 && delta < 2000, 'timeout should occur between 1-2 seconds')
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      server.close()
      t.end()
    })
    client.sendSpan({foo: 42})
  })
})

test('client.destroy() - on fresh client', function (t) {
  const client = new Client({
    userAgent: 'foo',
    meta: onmeta
  })
  client.on('finish', function () {
    t.fail('should not emit finish')
  })
  client.destroy()
  t.end()
})

test('client.destroy() - should not allow more writes', function (t) {
  t.plan(10)
  let count = 0

  const client = new Client({
    userAgent: 'foo',
    meta: onmeta
  })
  client.on('error', function (err) {
    t.ok(err instanceof Error, 'should emit error ' + err.message)
  })
  client.destroy()
  client.sendSpan({foo: 42}, done)
  client.sendTransaction({foo: 42}, done)
  client.sendError({foo: 42}, done)
  client.flush(done)
  client.end(done)

  function done () {
    t.pass('should still call callback even though it\'s destroyed')
    if (++count === 5) t.end()
  }
})

test('client.destroy() - on ended client', function (t) {
  t.plan(1)
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
    client.on('finish', function () {
      t.pass('should emit finish only once')
    })
    client.sendSpan({foo: 42})
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
    client.on('finish', function () {
      t.fail('should not emit finish')
    })
    client.sendSpan({foo: 42})
  })
})
