'use strict'

const test = require('tape')
const utils = require('./lib/utils')
const HttpsProxyAgent = require('https-proxy-agent')
const ProxyServer = require('./helpers/ProxyServer')

test('With a custom http.Agent and central config disabled', function (t) {
  t.plan(1)

  const proxy = new ProxyServer()
  const server = utils.APMServer(
    function (req, res) {
      req.resume()
      req.on('end', function () {
        res.end()
        t.deepEqual([`localhost:${server.address().port}`], proxy.requests, 'Client can traverse a HTTP proxy')
        server.close()
        proxy.close()
        t.end()
      })
    })

  proxy.listen(() => {
    server.client(
      { agent: new HttpsProxyAgent({ port: proxy.port() }) },
      (client) => {
        client.sendTransaction({ foo: 42 })
        client.flush()
      })
  })
})

test('With a custom http.Agent and central config enabled', function (t) {
  t.plan(1)

  const proxy = new ProxyServer()
  const server = utils.APMServer(
    function (req, res) {
      req.resume()
      req.on('end', function () {
        res.end()
        t.deepEqual([`localhost:${server.address().port}`], proxy.requests, 'Client can traverse a HTTP proxy')
        server.close()
        proxy.close()
        t.end()
      })
    })

  proxy.listen(() => {
    server.client(
      { agent: new HttpsProxyAgent({ port: proxy.port() }), centralConfig: true },
      () => {}) // We do nothing with the client, there's only the central config request
  })
})
