'use strict'

const test = require('tape')
const utils = require('./lib/utils')

const APMServer = utils.APMServer
const processIntakeReq = utils.processIntakeReq
const assertIntakeReq = utils.assertIntakeReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent

const dataTypes = ['span', 'transaction', 'error', 'metricset']

const upper = {
  span: 'Span',
  transaction: 'Transaction',
  error: 'Error',
  metricset: 'MetricSet'
}

dataTypes.forEach(function (dataType) {
  const sendFn = 'send' + upper[dataType]

  test(`client.${sendFn}() + client.flush()`, function (t) {
    t.plan(assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { foo: 42 } })
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
      client[sendFn]({ foo: 42 })
      client.flush()
    })
  })

  test(`client.${sendFn}(callback) + client.flush()`, function (t) {
    t.plan(1 + assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { foo: 42 } })
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
      let nexttick = false
      client[sendFn]({ foo: 42 }, function () {
        t.ok(nexttick, 'should call callback')
      })
      client.flush()
      nexttick = true
    })
  })

  test(`client.${sendFn}() + client.end()`, function (t) {
    t.plan(assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { foo: 42 } })
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
      client[sendFn]({ foo: 42 })
      client.end()
    })
  })

  test(`single client.${sendFn}`, function (t) {
    t.plan(assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { foo: 42 } })
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
    }).client({ time: 100 }, function (client) {
      client[sendFn]({ foo: 42 })
    })
  })

  test(`multiple client.${sendFn} (same request)`, function (t) {
    t.plan(assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts * 3)
    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { req: 1 } }),
      assertEvent({ [dataType]: { req: 2 } }),
      assertEvent({ [dataType]: { req: 3 } })
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
    }).client({ time: 100 }, function (client) {
      client[sendFn]({ req: 1 })
      client[sendFn]({ req: 2 })
      client[sendFn]({ req: 3 })
    })
  })

  test(`multiple client.${sendFn} (multiple requests)`, function (t) {
    t.plan(assertIntakeReq.asserts * 2 + assertMetadata.asserts * 2 + assertEvent.asserts * 6)

    let clientReqNum = 0
    let clientSendNum = 0
    let serverReqNum = 0
    let client

    const datas = [
      assertMetadata,
      assertEvent({ [dataType]: { req: 1, send: 1 } }),
      assertEvent({ [dataType]: { req: 1, send: 2 } }),
      assertEvent({ [dataType]: { req: 1, send: 3 } }),
      assertMetadata,
      assertEvent({ [dataType]: { req: 2, send: 4 } }),
      assertEvent({ [dataType]: { req: 2, send: 5 } }),
      assertEvent({ [dataType]: { req: 2, send: 6 } })
    ]

    const server = APMServer(function (req, res) {
      let reqNum = ++serverReqNum
      assertIntakeReq(t, req)
      req = processIntakeReq(req)
      req.on('data', function (obj) {
        datas.shift()(t, obj)
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
    }).client({ time: 100 }, function (_client) {
      client = _client
      send()
    })

    function send () {
      clientReqNum++
      for (let n = 0; n < 3; n++) {
        client[sendFn]({ req: clientReqNum, send: ++clientSendNum })
      }
    }
  })
})

test('client.flush(callback) - with active request', function (t) {
  t.plan(4 + assertIntakeReq.asserts + assertMetadata.asserts)
  const datas = [
    assertMetadata,
    { span: { foo: 42, name: 'undefined', type: 'undefined' } }
  ]
  const server = APMServer(function (req, res) {
    assertIntakeReq(t, req)
    req = processIntakeReq(req)
    req.on('data', function (obj) {
      const expect = datas.shift()
      if (typeof expect === 'function') expect(t, obj)
      else t.deepEqual(obj, expect)
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ bufferWindowTime: -1 }, function (client) {
    t.equal(client._active, false, 'no outgoing HTTP request to begin with')
    client.sendSpan({ foo: 42 })
    t.equal(client._active, true, 'an outgoing HTTP request should be active')
    client.flush(function () {
      t.equal(client._active, false, 'the outgoing HTTP request should be done')
    })
  })
})

test('client.flush(callback) - with queued request', function (t) {
  t.plan(4 + assertIntakeReq.asserts * 2 + assertMetadata.asserts * 2)
  let requests = 0
  const datas = [
    assertMetadata,
    { span: { req: 1, name: 'undefined', type: 'undefined' } },
    assertMetadata,
    { span: { req: 2, name: 'undefined', type: 'undefined' } }
  ]
  const server = APMServer(function (req, res) {
    assertIntakeReq(t, req)
    req = processIntakeReq(req)
    req.on('data', function (obj) {
      const expect = datas.shift()
      if (typeof expect === 'function') expect(t, obj)
      else t.deepEqual(obj, expect)
    })
    req.on('end', function () {
      res.end()
      if (++requests === 2) {
        t.end()
        server.close()
      }
    })
  }).client({ bufferWindowTime: -1 }, function (client) {
    client.sendSpan({ req: 1 })
    client.flush()
    client.sendSpan({ req: 2 })
    t.equal(client._active, true, 'an outgoing HTTP request should be active')
    client.flush(function () {
      t.equal(client._active, false, 'the outgoing HTTP request should be done')
    })
  })
})

test('2nd flush before 1st flush have finished', function (t) {
  t.plan(4 + assertIntakeReq.asserts * 2 + assertMetadata.asserts * 2)
  let requestStarts = 0
  let requestEnds = 0
  const datas = [
    assertMetadata,
    { span: { req: 1, name: 'undefined', type: 'undefined' } },
    assertMetadata,
    { span: { req: 2, name: 'undefined', type: 'undefined' } }
  ]
  const server = APMServer(function (req, res) {
    requestStarts++
    assertIntakeReq(t, req)
    req = processIntakeReq(req)
    req.on('data', function (obj) {
      const expect = datas.shift()
      if (typeof expect === 'function') expect(t, obj)
      else t.deepEqual(obj, expect)
    })
    req.on('end', function () {
      requestEnds++
      res.end()
    })
  }).client({ bufferWindowTime: -1 }, function (client) {
    client.sendSpan({ req: 1 })
    client.flush()
    client.sendSpan({ req: 2 })
    client.flush()
    setTimeout(function () {
      t.equal(requestStarts, 2, 'should have received 2 requests')
      t.equal(requestEnds, 2, 'should have received 2 requests completely')
      t.end()
      server.close()
    }, 200)
  })
})

test('client.end(callback)', function (t) {
  t.plan(1 + assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)
  const datas = [
    assertMetadata,
    assertEvent({ span: { foo: 42 } })
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
    client.sendSpan({ foo: 42 })
    client.end(function () {
      t.pass('should call callback')
    })
  })
})

test('client.sent', function (t) {
  t.plan(4)
  let client
  let requests = 0
  const server = APMServer(function (req, res) {
    req.resume()
    req.on('end', function () {
      res.end()
      if (++requests === 2) {
        server.close()
        t.end()
      }
    })
  }).client(function (_client) {
    client = _client
    client.sendError({ foo: 42 })
    client.sendSpan({ foo: 42 })
    client.sendTransaction({ foo: 42 })
    t.equal(client.sent, 0, 'after 1st round of sending')
    client.flush(function () {
      t.equal(client.sent, 3, 'after 1st flush')
      client.sendError({ foo: 42 })
      client.sendSpan({ foo: 42 })
      client.sendTransaction({ foo: 42 })
      t.equal(client.sent, 3, 'after 2nd round of sending')
      client.flush(function () {
        t.equal(client.sent, 6, 'after 2nd flush')
      })
    })
  })
})

test('should not open new request until it\'s needed after flush', function (t) {
  let client
  let requests = 0
  let expectRequest = false
  const server = APMServer(function (req, res) {
    t.equal(expectRequest, true, 'should only send new request when expected')
    expectRequest = false

    req.resume()
    req.on('end', function () {
      res.end()

      if (++requests === 2) {
        server.close()
        t.end()
      } else {
        setTimeout(sendData, 250)
      }
    })
  }).client(function (_client) {
    client = _client
    sendData()
  })

  function sendData () {
    expectRequest = true
    client.sendError({ foo: 42 })
    client.flush()
  }
})

test('should not open new request until it\'s needed after timeout', function (t) {
  let client
  let requests = 0
  let expectRequest = false
  const server = APMServer(function (req, res) {
    t.equal(expectRequest, true, 'should only send new request when expected')
    expectRequest = false

    req.resume()
    req.on('end', function () {
      res.end()

      if (++requests === 2) {
        server.close()
        t.end()
      } else {
        setTimeout(sendData, 250)
      }
    })
  }).client({ time: 1 }, function (_client) {
    client = _client
    sendData()
  })

  function sendData () {
    expectRequest = true
    client.sendError({ foo: 42 })
  }
})
