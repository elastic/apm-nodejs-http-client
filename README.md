# opbeat-http-client

[![Build status](https://travis-ci.org/watson/opbeat-http-client.svg?branch=master)](https://travis-ci.org/watson/opbeat-http-client)

[![js-standard-style](https://raw.githubusercontent.com/feross/standard/master/badge.png)](https://github.com/feross/standard)

An HTTP client for communicating with the Opbeat intake API.

This module is meant for building other modules that needs to
communicate with Opbeat

## Installation

```
npm install opbeat-http-client
```

## Usage

```js
var opbeatHttpClient = require('opbeat-http-client')({
  appId: '...',
  organizationId: '...',
  secretToken: '...',
  userAgent: '...'
})

opbeatHttpClient.request('errors', body, function (err, res, body) {
  if (err) throw err
  console.log(body)
})
```

## License

MIT
