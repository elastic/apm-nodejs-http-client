# elastic-apm-http-client changelog

## v11.0.1

- Fix an issue when running in a Lambda function, where a missing or erroring
  APM Lambda extension could result in apmclient back-off such that (a) the
  end-of-lambda-invocation signaling (`?flushed=true`) would not happen and
  (b) premature "beforeExit" event could result in the Lambda Runtime
  responding `null` before the Lambda function could respond
  (https://github.com/elastic/apm-agent-nodejs/issues/1831).

## v11.0.0

- Add support for coordinating data flushing in an AWS Lambda environment. The
  following two API additions are used to ensure that (a) the Elastic Lambda
  extension is signaled at invocation end [per spec](https://github.com/elastic/apm/blob/main/specs/agents/tracing-instrumentation-aws-lambda.md#data-flushing)
  and (b) a new intake request is not started when a Lambda function invocation
  is not active.

  - `Client#lambdaStart()` should be used to indicate when a Lambda function
    invocation begins.
  - `Client#flush([opts,] cb)` now supports an optional `opts.lambdaEnd`
    boolean. Set it to true to indicate this is a flush at the end of a Lambda
    function invocation.

  This is a **BREAKING CHANGE**, because current versions of elastic-apm-node
  depend on `^10.4.0`. If this were released as another 10.x, then usage of
  current elastic-apm-node with this version of the client would break
  behavior in a Lambda environment.

- Add the `freeSocketTimeout` option, with a default of 4000 (ms), and switch
  from Node.js's core `http.Agent` to the [agentkeepalive package](https://github.com/node-modules/agentkeepalive)
  to fix ECONNRESET issues with HTTP Keep-Alive usage talking to APM Server
  (https://github.com/elastic/apm-agent-nodejs/issues/2594).

## v10.4.0

- Add APM Server version checking to the client. On creation the client will
  call the [APM Server Information API](https://www.elastic.co/guide/en/apm/server/current/server-info.html)
  to get the server version and save that.

  The new `Client#supportsKeepingUnsampledTransaction()` boolean method returns
  `true` if APM Server is a version that requires unsampled transactions to
  be sent. This will be used by the APM Agent to [drop unsampled transactions
  for newer APM Servers](https://github.com/elastic/apm-agent-nodejs/issues/2455).

  There is a new `apmServerVersion: <string>` config option to tell the Client
  to skip fetching the APM Server version and use the given value. This config
  option is intended mainly for internal test suite usage.

## v10.3.0

- Add the `expectExtraMetadata: true` configuration option and
  `Client#setExtraMetadata(metadata)` method to provide a mechanism for the
  Node.js APM Agent to pass in metadata asynchronously and be sure that the
  client will not begin an intake request until that metadata is provided.
  This is to support passing in [AWS Lambda metadata that cannot be gathered
  until the first Lambda function
  invocation](https://github.com/elastic/apm-agent-nodejs/issues/2404).
  (Note: The `expectExtraMetadata` option cannot be used in combination with
  `cloudMetadataFetcher`.)

- Use `Z_BEST_SPEED` for gzip compression per
  https://github.com/elastic/apm/blob/main/specs/agents/transport.md#compression

## v10.2.0

- The client will no longer append data to the configured `userAgent` string.
  Before this it would append " elastic-apm-http-client/$ver node/$ver". This
  is to support [the APM agents spec for
  User-Agent](https://github.com/elastic/apm/blob/main/specs/agents/transport.md#user-agent).


## v10.1.0

- Fix client handling of an AWS Lambda environment:
  1. `client.flush()` will initiate a quicker completion of the current intake
     request.
  2. The process 'beforeExit' event is *not* used to start a graceful shutdown
     of the client, because the Lambda Runtime sometimes uses 'beforeExit' to
     handle *freezing* of the Lambda VM instance. That VM instance is typically
     unfrozen and used again, for which this Client is still needed.

## v10.0.0

- All truncation of string fields (per `truncate*At` config options) have
  changed from truncating at a number of unicode chars, rather than a number
  of bytes. This is both faster and matches [the json-schema spec](https://json-schema.org/draft/2019-09/json-schema-validation.html#rfc.section.6.3.1)
  for [apm-server intake fields](https://www.elastic.co/guide/en/apm/server/current/events-api.html#events-api-schema-definition)
  that specify `maxLength`.
- BREAKING CHANGE: The `truncateQueriesAt` config option has been removed.
- In its place the `truncateLongFieldsAt` config option has been added to cover
  `span.context.db.statement` and a number of other possibly-long fields (per
  [spec](https://github.com/elastic/apm/blob/main/specs/agents/field-limits.md#long_field_max_length-configuration)).
  This *does* mean that in rare cases of long field values longer than the
  default 10000 chars, this change will result in those values being truncated.
- The `truncateErrorMessagesAt` config option has been deprecated, in favor
  of `truncateLongFieldsAt`. Note, however, that `truncateLongFieldsAt` does
  *not* support the special case `-1` value to disable truncation. If
  `truncateErrorMessagesAt` is not specified, the value for
  `truncateLongFieldsAt` is used. This means the effective default is now 10000,
  no longer 2048.

## v9.9.0

- feat: Use uninstrumented HTTP(S) client request functions to avoid tracing
  requests made by the APM agent itself.
  ([#161](https://github.com/elastic/apm-nodejs-http-client/pull/161))

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
    https://github.com/elastic/apm/blob/main/specs/agents/transport.md#transport-errors

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
  [Client constructor](https://github.com/elastic/apm-nodejs-http-client/blob/main/README.md#new-clientoptions).
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
