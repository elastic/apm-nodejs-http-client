'use strict'

const Client = require('../')

const client = new Client({
  serverUrl: process.argv[2],
  secretToken: 'secret',
  userAgent: 'foo',
  meta: function () {
    return {}
  }
})

process.stdout.write(String(Date.now()))

client.writeSpan({hello: 'world'}) // Don't end the stream
