'use strict'

const Client = require('../../')

const client = new Client({
  serverUrl: process.argv[2],
  secretToken: 'secret',
  agentName: 'my-agent-name',
  agentVersion: 'my-agent-version',
  serviceName: 'my-service-name',
  userAgent: 'my-user-agent'
})

process.stdout.write(String(Date.now()))

client.sendSpan({ hello: 'world' }) // Don't end the stream
