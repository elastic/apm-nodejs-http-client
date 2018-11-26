'use strict'

const test = require('tape')
const { APMServer, processReq } = require('./lib/utils')

test('no environment variables', function (t) {
  t.plan(1)
  t.on('end', deleteEnv)

  deleteEnv()

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.equal(obj.metadata.kubernetes, undefined)
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (client) {
    client.sendError({})
    client.flush()
  })
})

test('KUBERNETES_NODE_NAME only', function (t) {
  t.plan(1)
  t.on('end', deleteEnv)

  deleteEnv()
  process.env.KUBERNETES_NODE_NAME = 'foo'

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, { node: { name: 'foo' } })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (client) {
    client.sendError({})
    client.flush()
  })
})

test('KUBERNETES_POD_NAMESPACE only', function (t) {
  t.plan(1)
  t.on('end', deleteEnv)

  deleteEnv()
  process.env.KUBERNETES_POD_NAMESPACE = 'foo'

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, { namespace: 'foo' })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (client) {
    client.sendError({})
    client.flush()
  })
})

test('KUBERNETES_POD_NAME only', function (t) {
  t.plan(1)
  t.on('end', deleteEnv)

  deleteEnv()
  process.env.KUBERNETES_POD_NAME = 'foo'

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, { pod: { name: 'foo' } })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (client) {
    client.sendError({})
    client.flush()
  })
})

test('KUBERNETES_POD_UID only', function (t) {
  t.plan(1)
  t.on('end', deleteEnv)

  deleteEnv()
  process.env.KUBERNETES_POD_UID = 'foo'

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, { pod: { uid: 'foo' } })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all', function (t) {
  t.plan(1)
  t.on('end', deleteEnv)

  process.env.KUBERNETES_NODE_NAME = 'foo'
  process.env.KUBERNETES_POD_NAMESPACE = 'bar'
  process.env.KUBERNETES_POD_NAME = 'baz'
  process.env.KUBERNETES_POD_UID = 'qux'

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, {
        namespace: 'bar',
        node: { name: 'foo' },
        pod: { name: 'baz', uid: 'qux' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(function (client) {
    client.sendError({})
    client.flush()
  })
})

function deleteEnv () {
  delete process.env.KUBERNETES_NODE_NAME
  delete process.env.KUBERNETES_POD_NAMESPACE
  delete process.env.KUBERNETES_POD_NAME
  delete process.env.KUBERNETES_POD_UID
}
