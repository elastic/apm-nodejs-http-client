'use strict'

const test = require('tape')
const { APMServer, processReq } = require('./lib/utils')

test('no environment variables', function (t) {
  t.plan(1)

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

test('k8sNodeName only', function (t) {
  t.plan(1)

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
  }).client({ k8sNodeName: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('k8sNamespace only', function (t) {
  t.plan(1)

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
  }).client({ k8sNamespace: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('k8sPodName only', function (t) {
  t.plan(1)

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
  }).client({ k8sPodName: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('k8sPodUID only', function (t) {
  t.plan(1)

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
  }).client({ k8sPodUID: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all', function (t) {
  t.plan(1)

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
  }).client({ k8sNodeName: 'foo', k8sNamespace: 'bar', k8sPodName: 'baz', k8sPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except k8sNodeName', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, {
        namespace: 'bar',
        pod: { name: 'baz', uid: 'qux' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ k8sNamespace: 'bar', k8sPodName: 'baz', k8sPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except k8sNamespace', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, {
        node: { name: 'foo' },
        pod: { name: 'baz', uid: 'qux' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ k8sNodeName: 'foo', k8sPodName: 'baz', k8sPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except k8sPodName', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, {
        namespace: 'bar',
        node: { name: 'foo' },
        pod: { uid: 'qux' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ k8sNodeName: 'foo', k8sNamespace: 'bar', k8sPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except k8sPodUID', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.kubernetes, {
        namespace: 'bar',
        node: { name: 'foo' },
        pod: { name: 'baz' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ k8sNodeName: 'foo', k8sNamespace: 'bar', k8sPodName: 'baz' }, function (client) {
    client.sendError({})
    client.flush()
  })
})
