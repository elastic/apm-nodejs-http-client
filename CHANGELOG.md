# elastic-apm-http-client changelog

## Unreleased

- Fix possible crash when polling apm-server for config. Specifically it
  could happen with the Elastic Node.js APM agent when:

  1. using node.js v12;
  2. instrumenting one of hapi, restify, koa, express, or fastify; and
  3. on a *second* request to APM server *that fails* (non-200 response).

  https://github.com/elastic/apm-agent-nodejs/issues/1749

## v9.5.0

(This changelog was started after the 9.5.0 release.)
