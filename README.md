# elastic-apm-http-client

[![Build status](https://travis-ci.org/elastic/apm-nodejs-http-client.svg?branch=master)](https://travis-ci.org/elastic/apm-nodejs-http-client)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

A low-level HTTP client for communicating with the Elastic APM intake
API.

This module is meant for building other modules that needs to
communicate with Elastic APM.

If you are looking to use Opbeat in your app or website, you'd most
likely want to check out [the official Opbeat module for
Node.js](https://github.com/opbeat/opbeat-node) instead.

## Installation

```
npm install elastic-apm-http-client
```

## Example Usage

```js
var elasticHttpClient = require('elastic-apm-http-client')({
  secretToken: '...',
  userAgent: '...'
})

elasticHttpClient.request('errors', body, function (err, res, body) {
  if (err) throw err
  console.log(body)
})
```

## API

The module exposes an initialize function which takes a single options
hash as the 1st argument. All properties are required:

- `apiHost` - The hostname of the Elastic APM intake API (default:
  `localhost`)
- `apiPort` - The port of the Elastic APM intake API (default: `8080`)
- `apiHttps` - Toggle http/https when communicating with the Elastic APM
  intake API (default: `false`)
- `secretToken` - The Elastic APM intake API secret token
- `userAgent` - The HTTP user agent that your module should identify it
  self with

The init function will return a low level HTTP client primed for
communicating with the Elastic APM intake API.

### `client.request(endpoint[, headers], body, callback)`

#### endpoint

The Elastic APM intake API v1 currently support the following endpoints:

- `errors`
- `transactions`

The default full URL's for those are:

```
http://localhost:8080/v1/<endpoint>
```

When specifying the `endpoint` argument in the `client.request()`
method, you just have to specify that last part of the URL, e.g.
"releases".

#### headers

An optional object that you can use to supply custom headers that should
be sent to the Elastic APM intake API.

#### body

The body should be in the form of a JavaScript object literal. The
elastic-apm-http-client will take care of encoding it correctly.

#### callback

The callback function is called with 3 arguments:

1. An error when applicable (usually from the
   [http.ClientRequest](https://nodejs.org/api/http.html#http_class_http_clientrequest)
   object)
1. An
   [http.IncomingMessage](https://nodejs.org/api/http.html#http_http_incomingmessage)
   object
1. The response body (as a String)

## License

MIT
