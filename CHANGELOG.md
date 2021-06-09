# elastic-apm-http-client changelog

## v9.8.1

- perf: eliminate encodeObject stack and faster loop in `_writeBatch`
  ([#159](https://github.com/elastic/apm-nodejs-http-client/pull/159))
- test: start testing with node 16
  ([#157](https://github.com/elastic/apm-nodejs-http-client/pull/157))

## v9.8.0

- Add `client.addMetadataFilter(fn)`. See the
  [APM agent issue](https://github.com/elastic/apm-agent-nodejs/issues/1916).

## v9.7.1

- Fix to ensure the `client.flush(cb)` callback is called in the (expected to
  be rare) case where there are no active handles -- i.e., the process is
  exiting.
  ([#150](https://github.com/elastic/apm-nodejs-http-client/issues/150))

## v9.7.0

- A number of changes were made to fix issues with the APM agent under heavy
  load and with a slow or non-responsive APM server.
  ([#144](https://github.com/elastic/apm-nodejs-http-client/pull/144))

  1. A new `maxQueueSize` config option is added (default 1024 for now) to
    control how many events (transactions, spans, errors, metricsets)
    will be queued before being dropped if events are incoming faster
    than can be sent to APM server. This ensures the APM agent memory usage
    does not grow unbounded.

  2. JSON encoding of events (when uncorking) is done in limited size
    batches to control the amount of single chunk CPU eventloop blocking
    time. (See MAX_WRITE_BATCH_SIZE in Client._writev.) Internal stats
    are collected to watch for long(est) batch processing times.

  3. The handling of individual requests to the APM Server intake API has
    be rewritten to handle some error cases -- especially from a
    non-responsive APM server -- and to ensure that only one intake
    request is being performed at a time. Two new config options --
    `intakeResTimeout` and `intakeResTimeoutOnEnd` -- have been added to
    allow fine control over some parts of this handling. See the comment on
    `makeIntakeRequest` for the best overview.

  4. Support for backoff on intake API requests has been implemented per
    https://github.com/elastic/apm/blob/master/specs/agents/transport.md#transport-errors

- Started testing against node v15 in preparation for supporting the coming
  node v16.

## v9.6.0

- Fix config initialization such that the keep-alive agent is used all the
  time, as intended. Before this change the keep-alive HTTP(S) agent would only
  be used if a second call to `client.config(...)` was made. For the [Elastic
  APM Agent](https://github.com/elastic/apm-agent-nodejs)'s usage of this
  module, that was when any of the express, fastify, restify, hapi, or koa
  modules was instrumented. ([#139](https://github.com/elastic/apm-nodejs-http-client/pull/139))

  A compatibility note for direct users of this APM http-client:
  Options passed to the
  [`Writable`](https://nodejs.org/api/stream.html#stream_new_stream_writable_options)
  and [`http[s].Agent`](https://nodejs.org/api/http.html#http_new_agent_options)
  constructors no longer include the full options object passed to the
  [Client constructor](https://github.com/elastic/apm-nodejs-http-client/blob/master/README.md#new-clientoptions).
  Therefore usage of *undocumented* options can no longer be used.

## v9.5.1

- Fix possible crash when polling apm-server for config. Specifically it
  could happen with the Elastic Node.js APM agent when:

  1. using node.js v12;
  2. instrumenting one of hapi, restify, koa, express, or fastify; and
  3. on a *second* request to APM server *that fails* (non-200 response).

  https://github.com/elastic/apm-agent-nodejs/issues/1749

## v9.5.0

(This changelog was started after the 9.5.0 release.)
