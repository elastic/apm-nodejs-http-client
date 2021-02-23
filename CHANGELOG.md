# elastic-apm-http-client changelog

## v9.5.1

- Fix config initialization such that the keep-alive agent is used all the
  time as intended. Before this change the keep-alive HTTP(S) agent would
  only be used if a second call to `client.config(...)` was made. For
  the Elastic APM Agent's usage of this module, that was when any of the
  express, fastify, restify, hapi, or koa modules was instrumented.

- Fix possible crash when polling apm-server for config. Specifically it
  could happen with the Elastic Node.js APM agent when:

  1. using node.js v12;
  2. instrumenting one of hapi, restify, koa, express, or fastify; and
  3. on a *second* request to APM server *that fails* (non-200 response).

  https://github.com/elastic/apm-agent-nodejs/issues/1749

## v9.5.0

(This changelog was started after the 9.5.0 release.)
