'use strict'

const net = require('net')
const http = require('http')

module.exports = class ProxyServer {
  constructor () {
    this.requests = []
    this.server = http.createServer()

    this.server.on('connect', (req, client) => {
      const [host, port] = req.url.split(':')
      const server = net.connect(port, host, function () {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')

        server.pipe(client).pipe(server)
      })

      this.requests.push(req.url)
      server.on('close', () => client.destroy())
    })
  }

  listen (callback) {
    return this.server.listen(callback)
  }

  close (callback) {
    return this.server.close(callback)
  }

  port () {
    return this.server.address().port
  }
}
