const tape = require('tape')
const Client = require('..')
const baseConf = {
  agentName:'a',
  agentVersion:'b',
  serviceName:'c',
  userAgent:'d'
}
tape.test('cloud metadata: updateEncodedMetadata', function(t) {
  const conf = Object.assign({}, baseConf)
  const client = new Client(conf)

  // test initial values
  const metadataPreUpdate = JSON.parse(client._encodedMetadata).metadata
  t.equals(metadataPreUpdate.service.name, baseConf.serviceName, 'initial service name set')
  t.equals(metadataPreUpdate.service.agent.name, baseConf.agentName, 'initial agent name set')
  t.equals(metadataPreUpdate.service.agent.version, baseConf.agentVersion, 'initial agent version set')
  t.ok(!metadataPreUpdate.cloud, 'no cloud metadata set initially')

  // tests that cloud metadata included in the _encodedPayload
  // is included after an update

  // inject our fixture
  metadataPreUpdate.cloud = {foo:'bar'}
  client._encodedMetadata = JSON.stringify({metadata:metadataPreUpdate})

  client.updateEncodedMetadata()

  const metadataPostUpdate = JSON.parse(client._encodedMetadata).metadata
  // console.log(metadataPostUpdate)
  t.equals(metadataPostUpdate.service.name, baseConf.serviceName, 'initial service name set')
  t.equals(metadataPostUpdate.service.agent.name, baseConf.agentName, 'initial agent name set')
  t.equals(metadataPostUpdate.service.agent.version, baseConf.agentVersion, 'initial agent version set')
  t.ok(metadataPostUpdate.cloud, 'cloud metadata still set after call to updateEncodedMetadata')
  t.equals(metadataPostUpdate.cloud.foo, 'bar', 'cloud metadata "passed through" on call to updateEncodedMetadata')
  t.end()
})

tape.test('cloud metadata: _fetchAndEncodeMetadata with no fetcher configured', function(t) {
  const conf = Object.assign({}, baseConf)
  const client = new Client(conf)
  client._fetchAndEncodeMetadata(function(){
    const metadata = JSON.parse(client._encodedMetadata).metadata
    t.equals(metadata.service.name, baseConf.serviceName, 'initial service name set')
    t.equals(metadata.service.agent.name, baseConf.agentName, 'initial agent name set')
    t.equals(metadata.service.agent.version, baseConf.agentVersion, 'initial agent version set')
    t.ok(!metadata.cloud, 'no cloud metadata set with a fetcher configured')
    t.end()
  })
})

tape.test('cloud metadata: _fetchAndEncodeMetadata with fetcher configured ', function(t) {
  // test with a fetcher configured
  const conf = Object.assign({}, baseConf)
  conf.cloudMetadataFetcher = function(cb) {
    process.nextTick(cb, null, {foo:'bar'})
  }
  const client = new Client(conf)
  client._fetchAndEncodeMetadata(function(){
    const metadata = JSON.parse(client._encodedMetadata).metadata
    t.equals(metadata.service.name, baseConf.serviceName, 'initial service name set')
    t.equals(metadata.service.agent.name, baseConf.agentName, 'initial agent name set')
    t.equals(metadata.service.agent.version, baseConf.agentVersion, 'initial agent version set')
    t.ok(metadata.cloud, 'cloud metadata set with a fetcher configured')
    t.equals(metadata.cloud.foo, 'bar', 'cloud metadata value represented')
    t.end()
  })
})

tape.test('cloud metadata: _fetchAndEncodeMetadata with fetcher configured but an error', function(t) {
  // fetcher configured but its callback returns an error
  const conf = Object.assign({}, baseConf)
  conf.cloudMetadataFetcher = function(cb) {
    const error = new Error('whoops')
    process.nextTick(cb, error, {foo:'bar'})
  }
  const client = new Client(conf)
  client._fetchAndEncodeMetadata(function(){
    const metadata = JSON.parse(client._encodedMetadata).metadata
    t.equals(metadata.service.name, baseConf.serviceName, 'initial service name set')
    t.equals(metadata.service.agent.name, baseConf.agentName, 'initial agent name set')
    t.equals(metadata.service.agent.version, baseConf.agentVersion, 'initial agent version set')
    t.ok(!metadata.cloud, 'cloud metadata not set when fetcher errors')
    t.end()
  })
})
