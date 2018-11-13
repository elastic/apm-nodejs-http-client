'use strict'

const test = require('tape')
const utils = require('./lib/utils')

const APMServer = utils.APMServer
const processReq = utils.processReq
const assertReq = utils.assertReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent

test('abort request if server responds early', function (t) {
  t.plan(assertReq.asserts * 2 + assertMetadata.asserts + assertEvent.asserts + 2)

  let reqs = 0
  let client

  const datas = [
    assertMetadata,
    assertEvent({span: {foo: 2}})
  ]

  const timer = setTimeout(function () {
    throw new Error('the test got stuck')
  }, 5000)

  const server = APMServer(function (req, res) {
    const reqNo = ++reqs

    assertReq(t, req)

    if (reqNo === 1) {
      res.writeHead(500)
      res.end('bad')

      // Wait a little to ensure the current stream have ended, so the next
      // span will force a new stream to be created
      setTimeout(function () {
        client.sendSpan({foo: 2})
        client.flush()
      }, 50)
    } else if (reqNo === 2) {
      req = processReq(req)
      req.on('data', function (obj) {
        datas.shift()(t, obj)
      })
      req.on('end', function () {
        res.end()
        clearTimeout(timer)
        server.close()
        t.end()
      })
    } else {
      t.fail('should not get more than two requests')
    }
  }).client(function (_client) {
    client = _client
    client.sendSpan({foo: 1})
    client.on('request-error', function (err) {
      t.equal(err.code, 500, 'should generate request-error with 500 status code')
      t.equal(err.response, 'bad', 'should generate request-error with expected body')
    })
  })
})
