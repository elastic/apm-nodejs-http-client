'use strict'

const test = require('tape')
const { APMServer, processIntakeReq } = require('./lib/utils')

test('no environment variables', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
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

test('kubernetesNodeName only', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, { node: { name: 'foo' } })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ kubernetesNodeName: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('kubernetesNamespace only', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, { namespace: 'foo' })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ kubernetesNamespace: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('kubernetesPodName only', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, { pod: { name: 'foo' } })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ kubernetesPodName: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('kubernetesPodUID only', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, { pod: { uid: 'foo' } })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ kubernetesPodUID: 'foo' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, {
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
  }).client({ kubernetesNodeName: 'foo', kubernetesNamespace: 'bar', kubernetesPodName: 'baz', kubernetesPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except kubernetesNodeName', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, {
        namespace: 'bar',
        pod: { name: 'baz', uid: 'qux' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ kubernetesNamespace: 'bar', kubernetesPodName: 'baz', kubernetesPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except kubernetesNamespace', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, {
        node: { name: 'foo' },
        pod: { name: 'baz', uid: 'qux' }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ kubernetesNodeName: 'foo', kubernetesPodName: 'baz', kubernetesPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except kubernetesPodName', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, {
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
  }).client({ kubernetesNodeName: 'foo', kubernetesNamespace: 'bar', kubernetesPodUID: 'qux' }, function (client) {
    client.sendError({})
    client.flush()
  })
})

test('all except kubernetesPodUID', function (t) {
  t.plan(1)

  const server = APMServer(function (req, res) {
    req = processIntakeReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj.metadata.system.kubernetes, {
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
  }).client({ kubernetesNodeName: 'foo', kubernetesNamespace: 'bar', kubernetesPodName: 'baz' }, function (client) {
    client.sendError({})
    client.flush()
  })
})
