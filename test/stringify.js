'use strict'

const test = require('tape')
const utils = require('./lib/utils')

const APMServer = utils.APMServer
const processReq = utils.processReq
const assertReq = utils.assertReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent

const dataTypes = ['transaction', 'error']
const properties = ['request', 'response']

const upper = {
  transaction: 'Transaction',
  error: 'Error'
}

dataTypes.forEach(function (dataType) {
  properties.forEach(function (prop) {
    const sendFn = 'send' + upper[dataType]

    test(`stringify ${dataType} ${prop} headers`, function (t) {
      t.plan(assertReq.asserts + assertMetadata.asserts + assertEvent.asserts)
      const datas = [
        assertMetadata,
        assertEvent({ [dataType]: {
          context: {
            [prop]: {
              headers: {
                string: 'foo',
                number: '42',
                bool: 'true',
                nan: 'NaN',
                object: '[object Object]',
                array: ['foo', '42', 'true', 'NaN', '[object Object]']
              }
            }
          }
        } })
      ]
      const server = APMServer(function (req, res) {
        assertReq(t, req)
        req = processReq(req)
        req.on('data', function (obj) {
          datas.shift()(t, obj)
        })
        req.on('end', function () {
          res.end()
          server.close()
          t.end()
        })
      }).client(function (client) {
        client[sendFn]({
          context: {
            [prop]: {
              headers: {
                string: 'foo',
                number: 42,
                bool: true,
                nan: NaN,
                object: { foo: 'bar' },
                array: ['foo', 42, true, NaN, { foo: 'bar' }]
              }
            }
          }
        })
        client.flush()
      })
    })
  })
})
