# elastic-apm-http-client

[![Build status](https://travis-ci.org/elastic/apm-nodejs-http-client.svg?branch=master)](https://travis-ci.org/elastic/apm-nodejs-http-client)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

A low-level HTTP client for communicating with the Elastic APM intake
API.

This module is meant for building other modules that needs to
communicate with Elastic APM.

If you are looking to use Elastic APM in your app or website, you'd most
likely want to check out [the official Elastic APM agent for
Node.js](https://github.com/elastic/apm-agent-nodejs) instead.

## Installation

```
npm install elastic-apm-http-client
```

## Example Usage

```js
const Client = require('elastic-apm-http-client')

const stream = Client({
  userAgent: 'My Custom Elastic APM Agent'
}, function (err) {
  throw err
})

stream.write(span)
```

## API

### `stream = Client(options[, onerror])`

Arguments:

- `options` - An object containing config options
- `onerror` - An optional error callback which will be called with an
  error object if the client ever encounters an error. If no `onerror`
  function is provided, any error that occur will be thrown

Config options:

- `userAgent` - (required) The HTTP user agent that your module should
  identify it self as
- `secretToken` - The Elastic APM intake API secret token
- `serverUrl` - The APM Server URL (default: `http://localhost:8200`)
- `rejectUnauthorized` - Set to `false` if the client shouldn't verify
  the APM Server TLS certificates (default: `true`)
- `serverTimeout` - HTTP request timeout in milliseconds. If no data is
  sent or received on the socket for this amount of time, the request
  will be aborted. It's not recommended to set a `serverTimeout` lower
  than the `time` config option. That might result in healthy requests
  being aborted prematurely (default: `15000` ms)
- `keepAlive` - If set the `false` the client will not reuse sockets
  between requests (default: `true`)
- `headers` - An object containing extra HTTP headers that should be
  used when making HTTP requests to he APM Server
- `size` - The maxiumum compressed body size (in bytes) of each HTTP
  request to the APM Server. An overshoot of up to the size of the
  internal zlib buffer should be expected as the buffer is flushed after
  this limit is reached. The default zlib buffer size is 16 kb (default:
  `1048576` bytes / 1 MB)
- `time` - The maxiumum number of milliseconds a streaming HTTP request
  to the APM Server can be ongoing before it's ended (default: `10000`
  ms)

The `Client` function will return a writable `stream`, to which the data
that should be sent to the APM Server should be written. The stream will
convert the data to [ndjson](http://ndjson.org), compress it using gzip,
and stream it to the APM Server.

## License

MIT
