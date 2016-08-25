# opbeat-http-client

[![Build status](https://travis-ci.org/watson/opbeat-http-client.svg?branch=master)](https://travis-ci.org/watson/opbeat-http-client)

[![js-standard-style](https://raw.githubusercontent.com/feross/standard/master/badge.png)](https://github.com/feross/standard)

A low-level HTTP client for communicating with the Opbeat intake API.

This module is meant for building other modules that needs to
communicate with Opbeat.

If you are looking to use Opbeat in your app or website, you'd most
likely want to check out [the official Opbeat module for
Node.js](https://github.com/opbeat/opbeat-node) instead.

## Installation

```
npm install opbeat-http-client
```

## Example Usage

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

## API

The module exposes an initialize function which takes a single options
hash as the 1st argument. All properties are required:

- `appId` - The Opbeat app id
- `organizationId` - The Opbeat organization id
- `secretToken` - The Opbeat secret token
- `userAgent` - The HTTP user agent that your module should identify it
  self with

The init function will return a low level HTTP client primed for
communicating with the Opbeat intake API.

### `client.request(endpoint, [headers], body, callback)`

#### endpoint

The Opbeat intake API v1 currently support the following two endpoints:

- `errors`
- `releases`

The full URL's for those are:

```
https://intake.opbeat.com/api/v1/organizations/<organization-id>/apps/<app-id>/<endpoint>/
```

When specifying the `endpoint` argument in the `client.request()`
method, you just have to specify that last part of the URL, e.g.
"releases".

#### headers

An optional object that you can use to supply custom headers that should
be sent to the Opbeat intake API.

#### body

The body should be in the form of a JavaScript object literal. The
opbeat-http-client will take care of encoding it correctly.

#### callback

The callback function is called with 3 arguments:

1. An error when applicable (usually from the [http.ClientRequest](https://nodejs.org/api/http.html#http_class_http_clientrequest) object)
1. An [http.IncomingMessage](https://nodejs.org/api/http.html#http_http_incomingmessage) object
1. The response body (as a String)

## License

MIT
