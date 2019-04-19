'use strict'

const path = require('path')
const fs = require('fs')
const getContainerInfo = require('container-info')
const os = require('os')
const ndjson = require('ndjson')
const test = require('tape')
const semver = require('semver')
const utils = require('./lib/utils')
const pkg = require('../package')
const Client = require('../')

const APMServer = utils.APMServer
const processReq = utils.processReq
const validOpts = utils.validOpts

test('package', function (t) {
  // these values are in the User-Agent header tests, so we need to make sure
  // they are as we expect
  t.equal(pkg.name, 'elastic-apm-http-client')
  t.ok(semver.valid(pkg.version))
  t.end()
})

test('throw if missing required options', function (t) {
  t.throws(() => new Client(), 'throws if no options are provided')
  t.throws(() => new Client({ agentName: 'foo' }), 'throws if only agentName is provided')
  t.throws(() => new Client({ agentVersion: 'foo' }), 'throws if only agentVersion is provided')
  t.throws(() => new Client({ serviceName: 'foo' }), 'throws if only serviceName is provided')
  t.throws(() => new Client({ userAgent: 'foo' }), 'throws if only userAgent is provided')
  t.throws(() => new Client({ agentName: 'foo', agentVersion: 'foo', serviceName: 'foo' }), 'throws if userAgent is missing')
  t.throws(() => new Client({ agentName: 'foo', agentVersion: 'foo', userAgent: 'foo' }), 'throws if serviceName is missing')
  t.throws(() => new Client({ agentName: 'foo', serviceName: 'foo', userAgent: 'foo' }), 'throws if agentVersion is missing')
  t.throws(() => new Client({ agentVersion: 'foo', serviceName: 'foo', userAgent: 'foo' }), 'throws if agentName is missing')
  t.doesNotThrow(() => new Client({ agentName: 'foo', agentVersion: 'foo', serviceName: 'foo', userAgent: 'foo' }), 'doesn\'t throw if required options are provided')
  t.end()
})

test('should work without new', function (t) {
  const client = Client(validOpts())
  t.ok(client instanceof Client)
  t.end()
})

test('null value config options shouldn\'t throw', function (t) {
  t.doesNotThrow(function () {
    new Client(validOpts({ // eslint-disable-line no-new
      size: null,
      time: null,
      serverTimeout: null,
      type: null,
      serverUrl: null,
      keepAlive: null,
      labels: null
    }))
  })
  t.end()
})

test('no secretToken', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    t.notOk('authorization' in req.headers)
    res.end()
    server.close()
    t.end()
  })
  server.listen(function () {
    const client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port
    }))
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('custom headers', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    t.equal(req.headers['x-foo'], 'bar')
    res.end()
    server.close()
    t.end()
  }).listen(function () {
    const client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port,
      headers: {
        'X-Foo': 'bar'
      }
    }))
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('serverUrl is invalid', function (t) {
  t.throws(function () {
    new Client(validOpts({ // eslint-disable-line no-new
      serverUrl: 'invalid'
    }))
  })
  t.end()
})

test('serverUrl contains path', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    t.equal(req.url, '/subpath/intake/v2/events')
    res.end()
    server.close()
    t.end()
  }).listen(function () {
    const client = new Client(validOpts({
      serverUrl: 'http://localhost:' + server.address().port + '/subpath'
    }))
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('reject unauthorized TLS by default', function (t) {
  t.plan(3)
  const server = APMServer({ secure: true }, function (req, res) {
    t.fail('should should not get request')
  }).client(function (client) {
    client.on('request-error', function (err) {
      t.ok(err instanceof Error)
      t.equal(err.message, 'self signed certificate')
      t.equal(err.code, 'DEPTH_ZERO_SELF_SIGNED_CERT')
      server.close()
      t.end()
    })
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('allow unauthorized TLS if asked', function (t) {
  t.plan(1)
  const server = APMServer({ secure: true }, function (req, res) {
    t.pass('should let request through')
    res.end()
    server.close()
    t.end()
  }).client({ rejectUnauthorized: false }, function (client) {
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('metadata', function (t) {
  t.plan(12)
  const opts = {
    agentName: 'custom-agentName',
    agentVersion: 'custom-agentVersion',
    serviceName: 'custom-serviceName',
    serviceVersion: 'custom-serviceVersion',
    frameworkName: 'custom-frameworkName',
    frameworkVersion: 'custom-frameworkVersion',
    hostname: 'custom-hostname',
    globalLabels: {
      foo: 'bar',
      doesNotNest: {
        'nope': 'this should be [object Object]'
      }
    }
  }
  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj, {
        metadata: {
          service: {
            name: 'custom-serviceName',
            version: 'custom-serviceVersion',
            runtime: {
              name: 'node',
              version: process.versions.node
            },
            language: {
              name: 'javascript'
            },
            agent: {
              name: 'custom-agentName',
              version: 'custom-agentVersion'
            },
            framework: {
              name: 'custom-frameworkName',
              version: 'custom-frameworkVersion'
            }
          },
          process: {
            pid: process.pid,
            ppid: process.ppid,
            title: process.title,
            argv: process.argv
          },
          system: {
            hostname: 'custom-hostname',
            architecture: process.arch,
            platform: process.platform
          },
          labels: {
            foo: 'bar',
            doesNotNest: '[object Object]'
          }
        }
      })
      t.ok(semver.valid(obj.metadata.service.runtime.version))
      t.ok(obj.metadata.process.pid > 0)
      t.ok(obj.metadata.process.ppid > 0)
      t.ok(/node$/.test(obj.metadata.process.title))
      t.ok(Array.isArray(obj.metadata.process.argv))
      t.ok(obj.metadata.process.argv.every(arg => typeof arg === 'string'))
      t.ok(obj.metadata.process.argv.every(arg => arg.length > 0))
      t.equal(typeof obj.metadata.system.architecture, 'string')
      t.ok(obj.metadata.system.architecture.length > 0)
      t.equal(typeof obj.metadata.system.platform, 'string')
      t.ok(obj.metadata.system.platform.length > 0)
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(opts, function (client) {
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('metadata - default values', function (t) {
  t.plan(1)
  const opts = {
    agentName: 'custom-agentName',
    agentVersion: 'custom-agentVersion',
    serviceName: 'custom-serviceName'
  }
  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.deepEqual(obj, {
        metadata: {
          service: {
            name: 'custom-serviceName',
            runtime: {
              name: 'node',
              version: process.versions.node
            },
            language: {
              name: 'javascript'
            },
            agent: {
              name: 'custom-agentName',
              version: 'custom-agentVersion'
            }
          },
          process: {
            pid: process.pid,
            ppid: process.ppid,
            title: process.title,
            argv: process.argv
          },
          system: {
            hostname: os.hostname(),
            architecture: process.arch,
            platform: process.platform
          }
        }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client(opts, function (client) {
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('metadata - container info', function (t) {
  // Clear Client and APMServer from require cache
  delete require.cache[require.resolve('../')]
  delete require.cache[require.resolve('./lib/utils')]

  const sync = getContainerInfo.sync
  getContainerInfo.sync = function sync () {
    return {
      containerId: 'container-id',
      podId: 'pod-id'
    }
  }
  t.on('end', () => {
    getContainerInfo.sync = sync
  })

  const APMServer = require('./lib/utils').APMServer

  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.ok(obj.metadata)
      t.ok(obj.metadata.system)
      t.deepEqual(obj.metadata.system.container, {
        id: 'container-id'
      })
      t.deepEqual(obj.metadata.system.kubernetes, {
        pod: {
          name: os.hostname(),
          uid: 'pod-id'
        }
      })
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({}, function (client) {
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('agentName', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.equal(obj.metadata.service.name, 'custom')
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ serviceName: 'custom' }, function (client) {
    client.sendSpan({ foo: 42 })
    client.end()
  })
})

test('payloadLogFile', function (t) {
  t.plan(6)

  const receivedObjects = []
  const filename = path.join(os.tmpdir(), Date.now() + '.ndjson')
  let requests = 0

  const server = APMServer(function (req, res) {
    const request = ++requests

    req = processReq(req)

    req.on('data', function (obj) {
      receivedObjects.push(obj)
    })

    req.on('end', function () {
      res.end()

      if (request === 2) {
        server.close()
        t.equal(receivedObjects.length, 5, 'should have received 5 objects')

        const file = fs.createReadStream(filename).pipe(ndjson.parse())

        file.on('data', function (obj) {
          const expected = receivedObjects.shift()
          const n = 5 - receivedObjects.length
          t.deepEqual(obj, expected, `expected line ${n} in the log file to match item no ${n} received by the server`)
        })

        file.on('end', function () {
          t.end()
        })
      }
    })
  }).client({ payloadLogFile: filename }, function (client) {
    client.sendTransaction({ req: 1 })
    client.sendSpan({ req: 2 })
    client.flush() // force the client to make a 2nd request so that we test reusing the file across requests
    client.sendError({ req: 3 })
    client.end()
  })
})

test('update conf', function (t) {
  t.plan(1)
  const server = APMServer(function (req, res) {
    req = processReq(req)
    req.once('data', function (obj) {
      t.equal(obj.metadata.service.name, 'bar')
    })
    req.on('end', function () {
      res.end()
      server.close()
      t.end()
    })
  }).client({ serviceName: 'foo' }, function (client) {
    client.config({ serviceName: 'bar' })
    client.sendSpan({ foo: 42 })
    client.end()
  })
})
