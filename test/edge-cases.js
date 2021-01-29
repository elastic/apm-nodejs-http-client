'use strict'

const http = require('http')
const test = require('tape')
const utils = require('./lib/utils')
const Client = require('../')

const APMServer = utils.APMServer
const processIntakeReq = utils.processIntakeReq
const assertIntakeReq = utils.assertIntakeReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent
const validOpts = utils.validOpts

test('Event: close - if ndjson stream ends', function (t) {
  t.plan(1)
  let client
  const server = APMServer(function (req, res) {
    client._chopper.end()
    setTimeout(function () {
      // wait a little to allow close to be emitted
      t.end()
      server.close()
    }, 10)
  }).listen(function () {
    client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))

    client.on('finish', function () {
      t.fail('should not emit finish event')
    })
    client.on('close', function () {
      t.pass('should emit close event')
    })

    client.sendSpan({ req: 1 })
  })
})

test('Event: close - if ndjson stream is destroyed', function (t) {
  t.plan(1)
  let client
  const server = APMServer(function (req, res) {
    client._chopper.destroy()
    setTimeout(function () {
      // wait a little to allow close to be emitted
      t.end()
      server.close()
    }, 10)
  }).listen(function () {
    client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))

    client.on('finish', function () {
      t.fail('should not emit finish event')
    })
    client.on('close', function () {
      t.pass('should emit close event')
    })

    client.sendSpan({ req: 1 })
  })
})

test('Event: close - if chopper ends', function (t) {
  t.plan(1)
  let client
  const server = APMServer(function (req, res) {
    client._chopper.end()
    setTimeout(function () {
      // wait a little to allow close to be emitted
      t.end()
      server.close()
    }, 10)
  }).listen(function () {
    client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))

    client.on('finish', function () {
      t.fail('should not emit finish event')
    })
    client.on('close', function () {
      t.pass('should emit close event')
    })

    client.sendSpan({ req: 1 })
  })
})

test('Event: close - if chopper is destroyed', function (t) {
  t.plan(1)
  let client
  const server = APMServer(function (req, res) {
    client._chopper.destroy()
    setTimeout(function () {
      // wait a little to allow close to be emitted
      t.end()
      server.close()
    }, 10)
  }).listen(function () {
    client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))

    client.on('finish', function () {
      t.fail('should not emit finish event')
    })
    client.on('close', function () {
      t.pass('should emit close event')
    })

    client.sendSpan({ req: 1 })
  })
})

test('write after end', function (t) {
  t.plan(2)
  const server = APMServer(function (req, res) {
    t.fail('should never get any request')
  }).client(function (client) {
    client.on('error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'write after end')
      server.close()
      t.end()
    })
    client.end()
    client.sendSpan({ foo: 42 })
  })
})

test('request with error - no body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.end()
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected APM Server response')
      t.equal(err.code, 418)
      t.equal(err.accepted, undefined)
      t.equal(err.errors, undefined)
      t.equal(err.response, undefined)
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.flush()
  })
})

test('request with error - non json body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.end('boom!')
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected APM Server response')
      t.equal(err.code, 418)
      t.equal(err.accepted, undefined)
      t.equal(err.errors, undefined)
      t.equal(err.response, 'boom!')
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.flush()
  })
})

test('request with error - invalid json body', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end('boom!')
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected APM Server response')
      t.equal(err.code, 418)
      t.equal(err.accepted, undefined)
      t.equal(err.errors, undefined)
      t.equal(err.response, 'boom!')
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.flush()
  })
})

test('request with error - json body without accepted or errors properties', function (t) {
  const body = JSON.stringify({ foo: 'bar' })
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end(body)
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected APM Server response')
      t.equal(err.code, 418)
      t.equal(err.accepted, undefined)
      t.equal(err.errors, undefined)
      t.equal(err.response, body)
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.flush()
  })
})

test('request with error - json body with accepted and errors properties', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ accepted: 42, errors: [{ message: 'bar' }] }))
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected APM Server response')
      t.equal(err.code, 418)
      t.equal(err.accepted, 42)
      t.deepEqual(err.errors, [{ message: 'bar' }])
      t.equal(err.response, undefined)
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.flush()
  })
})

test('request with error - json body where Content-Type contains charset', function (t) {
  const server = APMServer(function (req, res) {
    res.statusCode = 418
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ accepted: 42, errors: [{ message: 'bar' }] }))
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'Unexpected APM Server response')
      t.equal(err.code, 418)
      t.equal(err.accepted, 42)
      t.deepEqual(err.errors, [{ message: 'bar' }])
      t.equal(err.response, undefined)
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.flush()
  })
})

test('socket hang up', function (t) {
  const server = APMServer(function (req, res) {
    req.socket.destroy()
  }).client(function (client) {
    let closed = false
    client.on('request-error', function (err) {
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      // wait a little in case 'close' is emitted async
      setTimeout(function () {
        t.equal(closed, false, 'client should not emit close')
        t.end()
        server.close()
        client.destroy()
      }, 50)
    })
    client.on('close', function () {
      closed = true
    })
    client.on('finish', function () {
      t.fail('should not emit finish')
    })
    client.sendSpan({ foo: 42 })
  })
})

test('socket hang up - continue with new request', function (t) {
  t.plan(4 + assertIntakeReq.asserts * 2 + assertMetadata.asserts + assertEvent.asserts)
  let reqs = 0
  let client
  const datas = [
    assertMetadata,
    assertEvent({ span: { req: 2 } })
  ]
  const server = APMServer(function (req, res) {
    assertIntakeReq(t, req)

    if (++reqs === 1) return req.socket.destroy()

    // We have to attach the listener directly to the HTTP request stream as it
    // will receive the gzip header once the write have been made on the
    // client. If we were to attach it to the gunzip+ndjson, it would not fire
    req.on('data', function () {
      client.flush()
    })

    req = processIntakeReq(req)
    req.on('data', function (obj) {
      datas.shift()(t, obj)
    })
    req.on('end', function () {
      t.pass('should end request')
      res.end()
      server.close()
    })
  }).client(function (_client) {
    client = _client
    client.on('request-error', function (err) {
      t.equal(err.message, 'socket hang up')
      t.equal(err.code, 'ECONNRESET')
      client.sendSpan({ req: 2 })
    })
    client.on('finish', function () {
      t.equal(reqs, 2, 'should emit finish after last request')
      t.end()
    })
    client.sendSpan({ req: 1 })
  })
})

test('socket timeout - server response too slow', function (t) {
  const server = APMServer(function (req, res) {
    req.resume()
  }).client({ serverTimeout: 1000 }, function (client) {
    const start = Date.now()
    client.on('request-error', function (err) {
      const end = Date.now()
      const delta = end - start
      t.ok(delta > 1000 && delta < 2000, 'timeout should occur between 1-2 seconds')
      t.equal(err.message, 'APM Server response timeout (1000ms)')
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('socket timeout - client request too slow', function (t) {
  const server = APMServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
    })
  }).client({ serverTimeout: 1000 }, function (client) {
    const start = Date.now()
    client.on('request-error', function (err) {
      const end = Date.now()
      const delta = end - start
      t.ok(delta > 1000 && delta < 2000, 'timeout should occur between 1-2 seconds')
      t.equal(err.message, 'APM Server response timeout (1000ms)')
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
  })
})

test('client.destroy() - on fresh client', function (t) {
  t.plan(1)
  const client = new Client(validOpts())
  client.on('finish', function () {
    t.fail('should not emit finish')
  })
  client.on('close', function () {
    t.pass('should emit close')
  })
  client.destroy()
  process.nextTick(function () {
    // wait a little to allow close to be emitted
    t.end()
  })
})

test('client.destroy() - should not allow more writes', function (t) {
  t.plan(11)
  let count = 0

  const client = new Client(validOpts({ bufferWindowTime: -1 }))
  client.on('cloud-metadata', function () {
    client.on('error', function (err) {
      t.ok(err instanceof Error, 'should emit error ' + err.message)
    })
    client.on('finish', function () {
      t.pass('should emit finish') // emitted because of client.end()
    })
    client.on('close', function () {
      t.pass('should emit close') // emitted because of client.destroy()
    })
    client.destroy()
    client.sendSpan({ foo: 42 }, done)
    client.sendTransaction({ foo: 42 }, done)
    client.sendError({ foo: 42 }, done)
    client.flush(done)
    client.end(done)

    function done () {
      t.pass('should still call callback even though it\'s destroyed')
      if (++count === 5) t.end()
    }
  })
})

test('client.destroy() - on ended client', function (t) {
  t.plan(2)
  let client

  // create a server that doesn't unref incoming sockets to see if
  // `client.destroy()` will make the server close without hanging
  const server = http.createServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
      client.destroy()
      server.close()
      process.nextTick(function () {
        // wait a little to allow close to be emitted
        t.end()
      })
    })
  })

  server.listen(function () {
    client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))
    client.on('finish', function () {
      t.pass('should emit finish only once')
    })
    client.on('close', function () {
      t.pass('should emit close event')
    })
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('client.destroy() - on client with request in progress', function (t) {
  t.plan(1)
  let client

  // create a server that doesn't unref incoming sockets to see if
  // `client.destroy()` will make the server close without hanging
  const server = http.createServer(function (req, res) {
    server.close()
    client.destroy()
    process.nextTick(function () {
      // wait a little to allow close to be emitted
      t.end()
    })
  })

  server.listen(function () {
    client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))
    client.on('finish', function () {
      t.fail('should not emit finish')
    })
    client.on('close', function () {
      t.pass('should emit close event')
    })
    client.sendSpan({ foo: 42 })
  })
})

const dataTypes = ['span', 'transaction', 'error']

dataTypes.forEach(function (dataType) {
  const sendFn = 'send' + dataType.charAt(0).toUpperCase() + dataType.substr(1)

  test(`client.${sendFn}(): handle circular references`, function (t) {
    t.plan(assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { foo: 42, bar: '[Circular]' } })
    ]
    const server = APMServer(function (req, res) {
      assertIntakeReq(t, req)
      req = processIntakeReq(req)
      req.on('data', function (obj) {
        datas.shift()(t, obj)
      })
      req.on('end', function () {
        res.end()
        server.close()
        t.end()
      })
    }).client(function (client) {
      const obj = { foo: 42 }
      obj.bar = obj
      client[sendFn](obj)
      client.flush()
    })
  })
})
