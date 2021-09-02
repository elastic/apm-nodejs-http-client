'use strict'

const test = require('tape')
const { APMServer, processIntakeReq } = require('./lib/utils')
const getContainerInfo = require('container-info')
const containerInfo = require('../lib/container-info')

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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
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
    client.flush(() => { client.destroy() })
  })
})

test('Tests for ../lib/container-info', function (t) {
  const createMockForFixtureString = (source) => {
    const mock = {
      sync: () => {
        const string = source
        return getContainerInfo.parse(string)
      }
    }
    return mock
  }

  const fixtures = [
    {
      source: '12:freezer:/kubepods.slice/kubepods-pod22949dce_fd8b_11ea_8ede_98f2b32c645c.slice/docker-b15a5bdedd2e7645c3be271364324321b908314e4c77857bbfd32a041148c07f.scope',
      expectedPodId: '22949dce-fd8b-11ea-8ede-98f2b32c645c'
    },
    {
      source: '11:devices:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '10:perf_event:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '9:memory:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '8:freezer:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '7:hugetlb:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '6:cpuset:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '5:blkio:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '4:cpu,cpuacct:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '3:net_cls,net_prio:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '2:pids:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    },
    {
      source: '1:name=systemd:/kubepods/besteffort/pod74c13223-5a00-11e9-b385-42010a80018d/34dc0b5e626f2c5c4c5170e34b10e7654ce36f0fcd532739f4445baabea03376',
      expectedPodId: '74c13223-5a00-11e9-b385-42010a80018d'
    }
  ]
  for (const [, fixture] of fixtures.entries()) {
    const mock = createMockForFixtureString(fixture.source)
    const info = containerInfo(mock)
    t.equals(info.podId, fixture.expectedPodId, 'expected pod ID returned')
  }

  t.end()
})
