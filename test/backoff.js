'use strict'

const crypto = require('crypto')
const test = require('tape')
const utils = require('./lib/utils')

const APMServer = utils.APMServer
const processReq = utils.processReq
const assertReq = utils.assertReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent

const testCases = [
  {
    name: 'only one error',
    expectedData: [
      assertMetadata,
      assertEvent({span: {req: 2}}),
      assertMetadata,
      assertEvent({span: {req: 3}}),
      assertMetadata,
      assertEvent({span: {req: 4}})
    ],
    requests: [
      [0, true], // no back-off in effect, request fails
      [0, false], // back-off in effect, request succeeds
      [0, false], // no back-off in effect, request succeeds
      [0, false] // no back-off in effect, request succeeds
    ]
  },
  {
    name: 'only two errors',
    expectedData: [
      assertMetadata,
      assertEvent({span: {req: 3}}),
      assertMetadata,
      assertEvent({span: {req: 4}}),
      assertMetadata,
      assertEvent({span: {req: 5}})
    ],
    requests: [
      [0, true], // no back-off in effect, request fails
      [0, true], // back-off in effect, request fails
      [1, false], // back-off in effect, request succeeds
      [0, false], // no back-off in effect, request succeeds
      [0, false] // no back-off in effect, request succeeds
    ]
  },
  {
    name: 'top out at full back-off',
    expectedData: [
      assertMetadata,
      assertEvent({span: {req: 9}}),
      assertMetadata,
      assertEvent({span: {req: 10}}),
      assertMetadata,
      assertEvent({span: {req: 11}})
    ],
    requests: [
      [0, true], // no back-off in effect, request fails
      [0, true], // back-off in effect, request fails
      [1, true], // back-off in effect, request fails
      [4, true], // back-off in effect, request fails
      [9, true], // back-off in effect, request fails
      [16, true], // back-off in effect, request fails
      [25, true], // back-off in effect, request fails
      [36, true], // back-off in effect, request fails
      [36, false], // back-off in effect, request succeeds
      [0, false], // no back-off in effect, request succeeds
      [0, false] // no back-off in effect, request succeeds
    ]
  }
]

testCases.forEach(function ({name, expectedData, requests}) {
  test('backoff delays - ' + name, function (t) {
    let reqNo = 0
    let start, client

    const server = APMServer(function (req, res) {
      const diff = Date.now() - start
      const backoffTime = requests[reqNo - 1][0] * 1000
      t.ok(diff > backoffTime && diff < backoffTime + 200, `should delay request between ${backoffTime} and ${backoffTime + 200}ms (was delayed ${diff}ms)`)

      if (requests[reqNo - 1][1] === true) {
        res.writeHead(500)
        res.end()
      } else {
        assertReq(t, req)
        req = processReq(req)
        req.on('data', function (obj) {
          expectedData.shift()(t, obj)
        })
        req.on('end', function () {
          res.end()
          if (reqNo < 4) {
            setTimeout(makeReq, 10)
          } else {
            t.equal(expectedData.length, 0, 'should have seen all expected data')
            server.close()
            t.end()
          }
        })
      }
    }).client({time: 1000}, function (_client) {
      client = _client
      let emittedErrors = 0

      client.on('error', function (err) {
        emittedErrors++
        if (requests[reqNo - 1][1] === true) {
          t.equal(err.message, 'Unexpected response code from APM Server: 500', 'client should emit error')
          t.equal(client._errors, emittedErrors, 'client error count should have been incremented to ' + emittedErrors)
          makeReq()
        } else {
          t.error(err)
        }
      })

      makeReq()
    })

    function makeReq () {
      client.sendSpan({req: ++reqNo})
      start = Date.now()
      client.flush()
    }
  })
})

test('backoff - dropping data', function (t) {
  let start, timer
  let reqNo = 0
  const backoffTimes = [0, 0, 1, 0]

  const server = APMServer(function (req, res) {
    const diff = Date.now() - start
    const backoffTime = backoffTimes.shift() * 1000
    t.ok(diff > backoffTime && diff < backoffTime + 200, `should delay request between ${backoffTime} and ${backoffTime + 200}ms (was delayed ${diff}ms)`)

    req = processReq(req)
    req.on('data', function (obj) {
      if ('metadata' in obj) return
      t.equal(obj.span.req, reqNo, 'event belongs to expected request no ' + reqNo)
      t.equal(obj.span.ok, true, 'expected the event to get sent')
    })
    req.on('end', function () {
      if (reqNo <= 2) {
        res.writeHead(500)
        res.end()
      } else {
        clearTimeout(timer)
        res.end()
        server.close()
        t.end()
      }
    })
  }).client({size: 256, time: 500}, function (client) {
    client.on('error', function (err) {
      if (reqNo === 1) {
        t.equal(err.message, 'Unexpected response code from APM Server: 500', 'client should emit error')
        t.equal(client._errors, 1, 'client error count should have been incremented to 1')

        client.sendSpan({req: ++reqNo, ok: true, filler: crypto.randomBytes(32).toString('hex')})
        start = Date.now()
        client.flush()
      } else if (reqNo === 2) {
        t.equal(err.message, 'Unexpected response code from APM Server: 500', 'client should emit error')
        t.equal(client._errors, 2, 'client error count should have been incremented to 2')

        reqNo++
        start = Date.now()

        // these will be dropped because they are too big to be cached before the backoff
        client.sendSpan({req: reqNo, ok: false, filler: crypto.randomBytes(32).toString('hex')}) // will not overflow
        client.sendSpan({req: reqNo, ok: false, filler: crypto.randomBytes(32).toString('hex')}) // will trigger overflow

        // this will be the first to get through after the backoff
        client.sendSpan({req: reqNo, ok: true, filler: crypto.randomBytes(32).toString('hex')})

        timer = setTimeout(function () {
          t.fail('took too long')
        }, 2000)
      } else {
        t.error(err)
      }
    })

    client.sendSpan({req: ++reqNo, ok: true, filler: crypto.randomBytes(32).toString('hex')})
    start = Date.now()
    client.flush()
  })
})
