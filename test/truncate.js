'use strict'

const test = require('tape')
const utils = require('./lib/utils')

const APMServer = utils.APMServer
const processReq = utils.processReq
const assertReq = utils.assertReq
const assertMetadata = utils.assertMetadata
const assertEvent = utils.assertEvent

const options = [
  {}, // default options
  { truncateKeywordsAt: 1, truncateErrorMessagesAt: 1, truncateSourceLinesAt: 1 },
  { truncateErrorMessagesAt: -1 }
]

options.forEach(function (opts) {
  const veryLong = 9999
  const keywordLen = opts.truncateKeywordsAt || 1024
  const errMsgLen = opts.truncateErrorMessagesAt === -1
    ? veryLong
    : (opts.truncateErrorMessagesAt || 2048)
  const lineLen = opts.truncateSourceLinesAt || 1000

  test('truncate transaction', function (t) {
    t.plan(assertReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({
        transaction: {
          name: genStr('a', keywordLen),
          type: genStr('b', keywordLen),
          result: genStr('c', keywordLen),
          sampled: true,
          context: {
            request: {
              method: genStr('d', keywordLen),
              url: {
                protocol: genStr('e', keywordLen),
                hostname: genStr('f', keywordLen),
                port: genStr('g', keywordLen),
                pathname: genStr('h', keywordLen),
                search: genStr('i', keywordLen),
                hash: genStr('j', keywordLen),
                raw: genStr('k', keywordLen),
                full: genStr('l', keywordLen)
              }
            },
            user: {
              id: genStr('m', keywordLen),
              email: genStr('n', keywordLen),
              username: genStr('o', keywordLen)
            }
          }
        }
      })
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
    }).client(opts, function (client) {
      client.sendTransaction({
        name: genStr('a', veryLong),
        type: genStr('b', veryLong),
        result: genStr('c', veryLong),
        sampled: true,
        context: {
          request: {
            method: genStr('d', veryLong),
            url: {
              protocol: genStr('e', veryLong),
              hostname: genStr('f', veryLong),
              port: genStr('g', veryLong),
              pathname: genStr('h', veryLong),
              search: genStr('i', veryLong),
              hash: genStr('j', veryLong),
              raw: genStr('k', veryLong),
              full: genStr('l', veryLong)
            }
          },
          user: {
            id: genStr('m', veryLong),
            email: genStr('n', veryLong),
            username: genStr('o', veryLong)
          }
        }
      })
      client.flush()
    })
  })

  test('truncate span', function (t) {
    t.plan(assertReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({
        span: {
          name: genStr('a', keywordLen),
          type: genStr('b', keywordLen),
          stacktrace: [
            { pre_context: [genStr('c', lineLen), genStr('d', lineLen)], context_line: genStr('e', lineLen), post_context: [genStr('f', lineLen), genStr('g', lineLen)] },
            { pre_context: [genStr('h', lineLen), genStr('i', lineLen)], context_line: genStr('j', lineLen), post_context: [genStr('k', lineLen), genStr('l', lineLen)] }
          ]
        }
      })
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
    }).client(opts, function (client) {
      client.sendSpan({
        name: genStr('a', veryLong),
        type: genStr('b', veryLong),
        stacktrace: [
          { pre_context: [genStr('c', veryLong), genStr('d', veryLong)], context_line: genStr('e', veryLong), post_context: [genStr('f', veryLong), genStr('g', veryLong)] },
          { pre_context: [genStr('h', veryLong), genStr('i', veryLong)], context_line: genStr('j', veryLong), post_context: [genStr('k', veryLong), genStr('l', veryLong)] }
        ]
      })
      client.flush()
    })
  })

  test('truncate error', function (t) {
    t.plan(assertReq.asserts + assertMetadata.asserts + assertEvent.asserts)
    const datas = [
      assertMetadata,
      assertEvent({
        error: {
          log: {
            level: genStr('a', keywordLen),
            logger_name: genStr('b', keywordLen),
            message: genStr('c', errMsgLen),
            param_message: genStr('d', keywordLen),
            stacktrace: [
              { pre_context: [genStr('e', lineLen), genStr('f', lineLen)], context_line: genStr('g', lineLen), post_context: [genStr('h', lineLen), genStr('i', lineLen)] },
              { pre_context: [genStr('j', lineLen), genStr('k', lineLen)], context_line: genStr('l', lineLen), post_context: [genStr('m', lineLen), genStr('n', lineLen)] }
            ]
          },
          exception: {
            message: genStr('o', errMsgLen),
            type: genStr('p', keywordLen),
            code: genStr('q', keywordLen),
            module: genStr('r', keywordLen),
            stacktrace: [
              { pre_context: [genStr('s', lineLen), genStr('t', lineLen)], context_line: genStr('u', lineLen), post_context: [genStr('v', lineLen), genStr('w', lineLen)] },
              { pre_context: [genStr('x', lineLen), genStr('y', lineLen)], context_line: genStr('z', lineLen), post_context: [genStr('A', lineLen), genStr('B', lineLen)] }
            ]
          },
          context: {
            request: {
              method: genStr('C', keywordLen),
              url: {
                protocol: genStr('D', keywordLen),
                hostname: genStr('E', keywordLen),
                port: genStr('F', keywordLen),
                pathname: genStr('G', keywordLen),
                search: genStr('H', keywordLen),
                hash: genStr('I', keywordLen),
                raw: genStr('J', keywordLen),
                full: genStr('K', keywordLen)
              }
            },
            user: {
              id: genStr('L', keywordLen),
              email: genStr('M', keywordLen),
              username: genStr('N', keywordLen)
            }
          }
        }
      })
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
    }).client(opts, function (client) {
      client.sendError({
        log: {
          level: genStr('a', veryLong),
          logger_name: genStr('b', veryLong),
          message: genStr('c', veryLong),
          param_message: genStr('d', veryLong),
          stacktrace: [
            { pre_context: [genStr('e', veryLong), genStr('f', veryLong)], context_line: genStr('g', veryLong), post_context: [genStr('h', veryLong), genStr('i', veryLong)] },
            { pre_context: [genStr('j', veryLong), genStr('k', veryLong)], context_line: genStr('l', veryLong), post_context: [genStr('m', veryLong), genStr('n', veryLong)] }
          ]
        },
        exception: {
          message: genStr('o', veryLong),
          type: genStr('p', veryLong),
          code: genStr('q', veryLong),
          module: genStr('r', veryLong),
          stacktrace: [
            { pre_context: [genStr('s', veryLong), genStr('t', veryLong)], context_line: genStr('u', veryLong), post_context: [genStr('v', veryLong), genStr('w', veryLong)] },
            { pre_context: [genStr('x', veryLong), genStr('y', veryLong)], context_line: genStr('z', veryLong), post_context: [genStr('A', veryLong), genStr('B', veryLong)] }
          ]
        },
        context: {
          request: {
            method: genStr('C', veryLong),
            url: {
              protocol: genStr('D', veryLong),
              hostname: genStr('E', veryLong),
              port: genStr('F', veryLong),
              pathname: genStr('G', veryLong),
              search: genStr('H', veryLong),
              hash: genStr('I', veryLong),
              raw: genStr('J', veryLong),
              full: genStr('K', veryLong)
            }
          },
          user: {
            id: genStr('L', veryLong),
            email: genStr('M', veryLong),
            username: genStr('N', veryLong)
          }
        }
      })
      client.flush()
    })
  })
})

function genStr (ch, length) {
  return new Array(length + 1).join(ch)
}
