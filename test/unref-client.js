'use strict'

const Client = require('../')

const stream = Client({
  serverUrl: process.argv[2],
  secretToken: 'secret',
  userAgent: 'foo'
})

process.stdout.write(String(Date.now()))

stream.write({hello: 'world'}) // Don't end the stream
