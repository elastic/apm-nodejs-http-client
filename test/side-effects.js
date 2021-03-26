'use strict'

const path = require('path')
const exec = require('child_process').exec
const test = require('tape')
const utils = require('./lib/utils')

const APMServer = utils.APMServer
const processIntakeReq = utils.processIntakeReq
const assertIntakeReq = utils.assertIntakeReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent

test('client should not hold the process open (unref-client)', function (t) {
  t.plan(1 + assertIntakeReq.asserts + assertMetadata.asserts + assertEvent.asserts)

  const thingsToAssert = [
    assertMetadata,
    assertEvent({ span: { hello: 'world' } })
  ]

  const server = APMServer(function (req, res) {
    assertIntakeReq(t, req)
    req = processIntakeReq(req)
    req.on('data', function (obj) {
      thingsToAssert.shift()(t, obj)
    })
    req.on('end', function () {
      res.statusCode = 202
      res.end()
      server.close()
    })
  })

  server.listen(function () {
    const url = 'http://localhost:' + server.address().port
    const file = path.join(__dirname, 'lib', 'unref-client.js')
    exec(`node ${file} ${url}`, function (err, stdout, stderr) {
      if (stderr.trim()) {
        t.comment('stderr from unref-client.js:\n' + stderr)
      }
      if (err) {
        throw err
      }
      const end = Date.now()
      const start = Number(stdout)
      const duration = end - start
      t.ok(duration < 300, `should not take more than 300ms to complete (was: ${duration}ms)`)
      t.end()
    })
  })
})
