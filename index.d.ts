/// <reference types="node" />

// ///////////////////////////////////////////////////////////////////////////
// Logger

import { EventEmitter } from "events"

/** @see https://github.com/pinojs/pino/blob/master/pino.d.ts */

export declare interface LogFn {
  /* tslint:disable:no-unnecessary-generics */
  <T extends object>(obj: T, msg?: string, ...args: any[]): void;
  (obj: unknown, msg?: string, ...args: any[]): void;
  (msg: string, ...args: any[]): void;
}

export declare interface Bindings {
  [key: string]: any;
}

export declare type Logger = BaseLogger & LoggerExtras & Record<string, any>;

export declare interface BaseLogger {
    /**
     * Log at `'fatal'` level the given msg. If the first argument is an object, all its properties will be included in the JSON line.
     * If more args follows `msg`, these will be used to format `msg` using `util.format`.
     *
     * @typeParam T: the interface of the object being serialized. Default is object.
     * @param obj: object to be serialized
     * @param msg: the log message to write
     * @param ...args: format string values when `msg` is a format string
     */
    fatal: LogFn;
    /**
     * Log at `'error'` level the given msg. If the first argument is an object, all its properties will be included in the JSON line.
     * If more args follows `msg`, these will be used to format `msg` using `util.format`.
     *
     * @typeParam T: the interface of the object being serialized. Default is object.
     * @param obj: object to be serialized
     * @param msg: the log message to write
     * @param ...args: format string values when `msg` is a format string
     */
    error: LogFn;
    /**
     * Log at `'warn'` level the given msg. If the first argument is an object, all its properties will be included in the JSON line.
     * If more args follows `msg`, these will be used to format `msg` using `util.format`.
     *
     * @typeParam T: the interface of the object being serialized. Default is object.
     * @param obj: object to be serialized
     * @param msg: the log message to write
     * @param ...args: format string values when `msg` is a format string
     */
    warn: LogFn;
    /**
     * Log at `'info'` level the given msg. If the first argument is an object, all its properties will be included in the JSON line.
     * If more args follows `msg`, these will be used to format `msg` using `util.format`.
     *
     * @typeParam T: the interface of the object being serialized. Default is object.
     * @param obj: object to be serialized
     * @param msg: the log message to write
     * @param ...args: format string values when `msg` is a format string
     */
    info: LogFn;
    /**
     * Log at `'debug'` level the given msg. If the first argument is an object, all its properties will be included in the JSON line.
     * If more args follows `msg`, these will be used to format `msg` using `util.format`.
     *
     * @typeParam T: the interface of the object being serialized. Default is object.
     * @param obj: object to be serialized
     * @param msg: the log message to write
     * @param ...args: format string values when `msg` is a format string
     */
    debug: LogFn;
    /**
     * Log at `'trace'` level the given msg. If the first argument is an object, all its properties will be included in the JSON line.
     * If more args follows `msg`, these will be used to format `msg` using `util.format`.
     *
     * @typeParam T: the interface of the object being serialized. Default is object.
     * @param obj: object to be serialized
     * @param msg: the log message to write
     * @param ...args: format string values when `msg` is a format string
     */
    trace: LogFn;
}

export declare interface LoggerExtras extends EventEmitter {
    /**
     * Creates a child logger, setting all key-value pairs in `bindings` as properties in the log lines. All serializers will be applied to the given pair.
     * Child loggers use the same output stream as the parent and inherit the current log level of the parent at the time they are spawned.
     * From v2.x.x the log level of a child is mutable (whereas in v1.x.x it was immutable), and can be set independently of the parent.
     * If a `level` property is present in the object passed to `child` it will override the child logger level.
     *
     * @param bindings: an object of key-value pairs to include in log lines as properties.
     * @param options: an options object that will override child logger inherited options.
     * @returns a child logger instance.
     */
    child(bindings: Bindings): Logger;
}

// ///////////////////////////////////////////////////////////////////////////
// Options

/** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#new-clientoptions */
export declare interface Options {

  // Data sent to the APM Server as part of the metadata object:

  agentName: string // (required) The APM agent name
  agentVersion: string // (required) The APM agent version
  serviceName: string // (required) The name of the service being instrumented
  serviceNodeName?: string // Unique name of the service being instrumented
  serviceVersion?: string // The version of the service being instrumented
  frameworkName?: string // If the service being instrumented is running a specific framework, use this config option to log its name
  frameworkVersion?: string // If the service being instrumented is running a specific framework, use this config option to log its version
  hostname?: string // Custom hostname (default: OS hostname)
  environment?: string // Environment name (default: process.env.NODE_ENV || 'development')
  containerId?: string // Docker container id, if not given will be parsed from /proc/self/cgroup
  kubernetesNodeName?: string // Kubernetes node name
  kubernetesNamespace?: string // Kubernetes namespace
  kubernetesPodName?: string // Kubernetes pod name, if not given will be the hostname
  kubernetesPodUID?: string // Kubernetes pod id, if not given will be parsed from /proc/self/cgroup
  globalLabels?: {[key: string]: string} // An object of key/value pairs to use to label all data reported (only applied when using APM Server 7.1+)

  // HTTP client configuration:

  userAgent: string // (required) The HTTP user agent that your module should identify itself as
  secretToken?: string // The Elastic APM intake API secret token
  apiKey?: string // Elastic APM API key
  serverUrl?: string // The APM Server URL (default: http://localhost:8200)
  headers?: string // An object containing extra HTTP headers that should be used when making HTTP requests to he APM Server
  rejectUnauthorized?: boolean // Set to false if the client shouldn't verify the APM Server TLS certificates (default: true)
  serverCaCert?: string // The CA certificate used to verify the APM Server's TLS certificate, and has the same requirements as the ca option of tls.createSecureContext.
  serverTimeout?: number // HTTP request timeout in milliseconds. If no data is sent or received on the socket for this amount of time, the request will be aborted. It's not recommended to set a serverTimeout lower than the time config option. That might result in healthy requests being aborted prematurely. (default: 15000 ms)
  keepAlive?: boolean // If set the false the client will not reuse sockets between requests (default: true)
  keepAliveMsecs?: number // When using the keepAlive option, specifies the initial delay for TCP Keep-Alive packets. Ignored when the keepAlive option is false or undefined (default: 1000 ms)
  maxSockets?: string // Maximum number of sockets to allow per host (default: Infinity)
  maxFreeSockets?: number // Maximum number of sockets to leave open in a free state. Only relevant if keepAlive is set to true (default: 256)
  freeSocketTimeout?: number // A number of milliseconds of inactivity on a free (kept-alive) socket after which to timeout and recycle the socket. Set this to a value less than the HTTP Keep-Alive timeout of the APM server to avoid ECONNRESET exceptions. This defaults to 4000ms to be less than the node.js HTTP server default of 5s (useful when using a Node.js-based mock APM server) and the Go lang Dialer KeepAlive default of 15s (when talking to the Elastic APM Lambda extension). (default: 4000)

  // Cloud & Extra Metadata Configuration:

  cloudMetadataFetcher?: {[key: string]: undefined} // An object with a getCloudMetadata(cb) method for fetching metadata related to the current cloud environment. The callback is of the form function (err, cloudMetadata) and the returned cloudMetadata will be set on metadata.cloud for intake requests to APM Server. If provided, this client will not begin any intake requests until the callback is called. The cloudMetadataFetcher option must not be used with the expectExtraMetadata option.
  expectExtraMetadata?: boolean // A boolean option to indicate that the client should not allow any intake requests to begin until cloud.setExtraMetadata(...) has been called. It is the responsibility of the caller to call cloud.setExtraMetadata(). If not, then the Client will never perform an intake request. The expectExtraMetadata option must not be used with the cloudMetadataFetcher option.

  // APM Agent Configuration via Kibana:

  centralConfig?: boolean // Whether or not the client should poll the APM Server regularly for new agent configuration. If set to true, the config event will be emitted when there's an update to an agent config option (default: false). Requires APM Server v7.3 or later and that the APM Server is configured with kibana.enabled: true.

  // Streaming configuration:

  size?: number // The maxiumum compressed body size (in bytes) of each HTTP request to the APM Server. An overshoot of up to the size of the internal zlib buffer should be expected as the buffer is flushed after this limit is reached. The default zlib buffer size is 16kB. (default: 768000 bytes)
  time?: number // The maxiumum number of milliseconds a streaming HTTP request to the APM Server can be ongoing before it's ended. Set to -1 to disable (default: 10000 ms)
  bufferWindowTime?: number // Objects written in quick succession are buffered and grouped into larger clusters that can be processed as a whole. This config option controls the maximum time that buffer can live before it's flushed (counted in milliseconds). Set to -1 for no buffering (default: 20 ms)
  bufferWindowSize?: number // Objects written in quick succession are buffered and grouped into larger clusters that can be processed as a whole. This config option controls the maximum size of that buffer (counted in number of objects). Set to -1 for no max size (default: 50 objects)
  maxQueueSize?: number // The maximum number of buffered events (transactions, spans, errors, metricsets). Events are buffered when the agent can't keep up with sending them to the APM Server or if the APM server is down. If the queue is full, events are rejected which means transactions, spans, etc. will be lost. This guards the application from consuming unbounded memory, possibly overusing CPU (spent on serializing events), and possibly crashing in case the APM server is unavailable for a long period of time. A lower value will decrease the heap overhead of the agent, while a higher value makes it less likely to lose events in case of a temporary spike in throughput. (default: 1024)
  intakeResTimeout?: number // The time (in milliseconds) by which a response from the APM Server events intake API is expected after all the event data for that request has been sent. This allows a smaller timeout than serverTimeout to handle an APM server that is accepting connections but is slow to respond. (default: 10000 ms)
  intakeResTimeoutOnEnd?: number // The same as intakeResTimeout, but used when the client has ended, hence for the possible last request to APM server. This is typically a lower value to not hang an ending process that is waiting for that APM server request to complete. (default: 1000 ms)

  // Data sanitizing configuration:

  truncateKeywordsAt?: number // Maximum size in unicode characters for strings stored as Elasticsearch keywords. Strings larger than this will be trucated (default: 1024)
  truncateLongFieldsAt?: number // The maximum size in unicode characters for a specific set of long string fields. String values above this length will be truncated. Default: 10000.
  truncateStringsAt?: number // The maximum size in unicode characters for strings. String values above this length will be truncated (default: 1024)
  truncateErrorMessagesAt?: number // DEPRECATED: prefer truncateLongFieldsAt. The maximum size in unicode characters for error messages. Messages above this length will be truncated. Set to -1 to disable truncation. This applies to the following properties: error.exception.message and error.log.message. (default: 2048)

  // Debug options:

  logger?: Logger // A pino logger to use for trace and debug-level logging.
  payloadLogFile?: string // Specify a file path to which a copy of all data sent to the APM Server should be written. The data will be in ndjson format and will be uncompressed. Note that using this option can impact performance.
  apmServerVersion?: string // A string version to assume is the version of the APM Server at serverUrl. This option is typically only used for testing. Normally this client will fetch the APM Server version at startup via a GET / request. Setting this option avoids that request.
}

/** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientconfigoptions */
declare type OptionsForConfigFuction = Omit<Options, 'size' | 'time' | 'keepAlive' | 'keepAliveMsecs' | 'maxSockets' | 'maxFreeSockets' | 'centralConfig'>

// ///////////////////////////////////////////////////////////////////////////
// Callback

export declare type Callback = (err?: Error) => void

// ///////////////////////////////////////////////////////////////////////////
// Transaction

/**
 * @see https://github.com/elastic/apm-server/blob/v8.5.0/docs/spec/v2/transaction.json
 * @see https://www.elastic.co/guide/en/apm/server/current/exported-fields-apm-transaction.html
 * @see https://www.elastic.co/guide/en/apm/guide/current/data-model-transactions.html
 * @see https://github.com/elastic/apm-agent-nodejs/blob/v3.40.0/lib/instrumentation/transaction.js#L51
 */
export declare type Transaction = {

    context?: { // Context holds arbitrary contextual information for the event.

        cloud?: { // Cloud holds fields related to the cloud or infrastructure the events are coming from.
            origin?: { // Origin contains the self-nested field groups for cloud.
                account?: { // The cloud account or organization id used to identify different entities in a multi-tenant environment.
                    id?: string // The cloud account or organization id used to identify different entities in a multi-tenant environment.
                }
                provider?: string // Name of the cloud provider.
                region?: string // Region in which this host, resource, or service is located.
                service?: { // The cloud service name is intended to distinguish services running on different platforms within a provider.
                    name?: string // The cloud service name is intended to distinguish services running on different platforms within a provider.
                }
            }
        }

        custom?: {[key: string]: undefined} // Custom can contain additional metadata to be stored with the event. The format is unspecified and can be deeply nested objects. The information will not be indexed or searchable in Elasticsearch.

        message?: { // Message holds details related to message receiving and publishing if the captured event integrates with a messaging system
            age?: { // Age of the message. If the monitored messaging framework provides a timestamp for the message, agents may use it. Otherwise, the sending agent can add a timestamp in milliseconds since the Unix epoch to the message's metadata to be retrieved by the receiving agent. If a timestamp is not available, agents should omit this field.
                ms?: number // Age of the message in milliseconds.
            }
            body?: string // Body of the received message, similar to an HTTP request body
            headers?: {[key: string]: string | string[] | undefined} // Headers received with the message, similar to HTTP request headers.
            queue?: { // Queue holds information about the message queue where the message is received.
                name?: string // Name holds the name of the message queue where the message is received.
            }
            routing_key?: string // RoutingKey holds the optional routing key of the received message as set on the queuing system, such as in RabbitMQ.
        }

        page?: { // Page holds information related to the current page and page referers. It is only sent from RUM agents.
            referer?: string // Referer holds the URL of the page that 'linked' to the current page.
            url?: string // URL of the current page
        }

        request?: { // Request describes the HTTP request information in case the event was created as a result of an HTTP request.
            body?: {[key: string]: undefined} | string
            cookies?: {[key: string]: undefined} // Cookies used by the request, parsed as key-value objects.
            env?: {[key: string]: undefined} // Env holds environment variable information passed to the monitored service.
            headers?: {[key: string]: string | string[] | undefined} // Headers includes any HTTP headers sent by the requester. Cookies will be taken by headers if supplied.
            http_version?: string // HTTPVersion holds information about the used HTTP version.
            method: string // Method holds information about the method of the HTTP request.
            socket?: { // Socket holds information related to the recorded request, such as whether or not data were encrypted and the remote address.
                encrypted?: boolean // Encrypted indicates whether a request was sent as TLS/HTTPS request. DEPRECATED: this field will be removed in a future release.
                remote_address?: string // RemoteAddress holds the network address sending the request. It should be obtained through standard APIs and not be parsed from any headers like 'Forwarded'.
            }
            url?: { // URL holds information sucha as the raw URL, scheme, host and path.
                full?: string // Full, possibly agent-assembled URL of the request, e.g. https://example.com:443/search?q=elasticsearch#top.
                hash?: string // Hash of the request URL, e.g. 'top'
                hostname?: string // Hostname information of the request, e.g. 'example.com'.\"
                pathname?: string // Path of the request, e.g. '/search'
                port?: string | number // Port of the request, e.g. '443'. Can be sent as string or int.
                protocol?: string // Protocol information for the recorded request, e.g. 'https:'.
                raw?: string // Raw unparsed URL of the HTTP request line, e.g https://example.com:443/search?q=elasticsearch. This URL may be absolute or relative. For more details, see https://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html#sec5.1.2.
                search?: string // Search contains the query string information of the request. It is expected to have values delimited by ampersands.
            }
        }

        response?: { // Response describes the HTTP response information in case the event was created as a result of an HTTP request.
            decoded_body_size?: number // DecodedBodySize holds the size of the decoded payload.
            encoded_body_size?: number // EncodedBodySize holds the size of the encoded payload.
            finished?: boolean // Finished indicates whether the response was finished or not.
            headers?: {[key: string]: string | string[] | undefined} // Headers holds the http headers sent in the http response.
            headers_sent?: boolean // HeadersSent indicates whether http headers were sent.
            status_code?: number // StatusCode sent in the http response.
            transfer_size?: number // TransferSize holds the total size of the payload.
        }

        service?: { // Service related information can be sent per event. Information provided here will override the more generic information retrieved from metadata, missing service fields will be retrieved from the metadata information.
            agent?: { // Agent holds information about the APM agent capturing the event.
                ephemeral_id?: string // EphemeralID is a free format ID used for metrics correlation by agents
                name?: string // Name of the APM agent capturing information.
                version?: string // Version of the APM agent capturing information.
            }
            environment?: string // Environment in which the monitored service is running, e.g. `production` or `staging`.
            framework?: { // Framework holds information about the framework used in the monitored service.
                name?: string // Name of the used framework
                version?: string // Version of the used framework
            }
            id?: string // ID holds a unique identifier for the service.
            language?: { // Language holds information about the programming language of the monitored service.
                name?: string // Name of the used programming language
                version?: string // Version of the used programming language
            }
            name?: string // Name of the monitored service.
            node?: { // Node must be a unique meaningful name of the service node.
                configured_name?: string // Name of the service node
            }
            origin?: { // Origin contains the self-nested field groups for service.
                id?: string // Immutable id of the service emitting this event.
                name?: string // Immutable name of the service emitting this event.
                version?: string // The version of the service the data was collected from.
            }
            runtime?: { // Runtime holds information about the language runtime running the monitored service
                name?: string // Name of the language runtime
                version?: string // Version of the language runtime
            }
            target?: { // Target holds information about the outgoing service in case of an outgoing event
                name: string // Immutable name of the target service for the event
            } | {
                type: string // Immutable type of the target service for the event
            }
            version?: string // Version of the monitored service.
        }

        tags?: {[key: string]: string | null | boolean | number | undefined } // Tags are a flat mapping of user-defined tags. On the agent side, tags are called labels. Allowed value types are string, boolean and number values. Tags are indexed and searchable.

        user?: { // User holds information about the correlated user for this event. If user data are provided here, all user related information from metadata is ignored, otherwise the metadata's user information will be stored with the event.
            domain?: string // Domain of the logged in user
            email?: string // Email of the user.
            id?: string | number // ID identifies the logged in user, e.g. can be the primary key of the user
            username?: string // Name of the user.
        }
    }

    dropped_spans_stats?: Array<{ // DroppedSpanStats holds information about spans that were dropped (for example due to transaction_max_spans or exit_span_min_duration).
        destination_service_resource?: string // DestinationServiceResource identifies the destination service resource being operated on. e.g. 'http://elastic.co:80', 'elasticsearch', 'rabbitmq/queue_name'.
        duration?: { // Duration holds duration aggregations about the dropped span.
            count?: number // Count holds the number of times the dropped span happened.
            sum?: { // Sum holds dimensions about the dropped span's duration.
                us?: number // Us represents the summation of the span duration.
            }
        }
        outcome?: "success" | "failure" | "unknown" // Outcome of the span: success, failure, or unknown. Outcome may be one of a limited set of permitted values describing the success or failure of the span. It can be used for calculating error rates for outgoing requests.
        service_target_name?: string // ServiceTargetName identifies the instance name of the target service being operated on
        service_target_type?: string // ServiceTargetType identifies the type of the target service being operated on e.g. 'oracle', 'rabbitmq'
    }>

    duration: number // Duration how long the transaction took to complete, in milliseconds with 3 decimal points.

    experience?: { // UserExperience holds metrics for measuring real user experience. This information is only sent by RUM agents.
        cls?: number // CumulativeLayoutShift holds the Cumulative Layout Shift (CLS) metric value, or a negative value if CLS is unknown. See https://web.dev/cls/
        fid?: number // FirstInputDelay holds the First Input Delay (FID) metric value, or a negative value if FID is unknown. See https://web.dev/fid/
        longtask?: { // Longtask holds longtask duration/count metrics.
            count: number // Count is the total number of of longtasks.
            max: number // Max longtask duration
            sum: number // Sum of longtask durations
        }
        tbt?: number // TotalBlockingTime holds the Total Blocking Time (TBT) metric value, or a negative value if TBT is unknown. See https://web.dev/tbt/
    }

    faas?: { // FAAS holds fields related to Function as a Service events.
        coldstart?: boolean // Indicates whether a function invocation was a cold start or not.
        execution?: string // The request id of the function invocation.
        id?: string // A unique identifier of the invoked serverless function.
        name?: string // The lambda function name.
        trigger?: { // Trigger attributes.
            request_id?: string // The id of the origin trigger request.
            type?: string // The trigger type.
        }
        version?: string // The lambda function version.
    }

    id: string // ID holds the hex encoded 64 random bits ID of the event.

    links?: Array<{ // Links holds links to other spans, potentially in other traces.
        span_id: string // SpanID holds the ID of the linked span.
        trace_id: string  // TraceID holds the ID of the linked span's trace.
    }>

    marks?: { // Marks capture the timing of a significant event during the lifetime of a transaction. Marks are organized into groups and can be set by the user or the agent. Marks are only reported by RUM agents.
        type?: {
            type: number
        }
    }

    name?: string // Name is the generic designation of a transaction in the scope of a single service, eg: 'GET /users/:id'.

    otel?: { // OTel contains unmapped OpenTelemetry attributes.
        attributes?: string // Attributes hold the unmapped OpenTelemetry attributes.
        span_kind?: string // SpanKind holds the incoming OpenTelemetry span kind.
    }

    outcome?: "success" | "failure" |  "unknown" // Outcome of the transaction with a limited set of permitted values, describing the success or failure of the transaction from the service's perspective. It is used for calculating error rates for incoming requests. Permitted values: success, failure, unknown.
    parent_id?: string // ParentID holds the hex encoded 64 random bits ID of the parent transaction or span.
    result?: string // Result of the transaction. For HTTP-related transactions, this should be the status code formatted like 'HTTP 2xx'.
    sample_rate?: number // SampleRate applied to the monitored service at the time where this transaction was recorded. Allowed values are [0..1]. A SampleRate <1 indicates that not all spans are recorded.
    sampled?: boolean // Sampled indicates whether or not the full information for a transaction is captured. If a transaction is unsampled no spans and less context information will be reported.
    
    session?: { // Session holds optional transaction session information for RUM.
        id: string // ID holds a session ID for grouping a set of related transactions.
        sequence: number // Sequence holds an optional sequence number for a transaction within a session. It is not meaningful to compare sequences across two different sessions.
    }

    span_count: { // SpanCount counts correlated spans.
        dropped?: string // Dropped is the number of correlated spans that have been dropped by the APM agent recording the transaction.
        started: number // Started is the number of correlated spans that are recorded.
    }

    timestamp?: number // Timestamp holds the recorded time of the event, UTC based and formatted as microseconds since Unix epoch
    trace_id: string // TraceID holds the hex encoded 128 random bits ID of the correlated trace.
    type: string // Type expresses the transaction's type as keyword that has specific relevance within the service's domain, eg: 'request', 'backgroundjob'.
}

// ///////////////////////////////////////////////////////////////////////////
// Span

/**
 * @see https://github.com/elastic/apm-server/blob/v8.5.0/docs/spec/v2/span.json
 * @see https://www.elastic.co/guide/en/apm/server/current/exported-fields-apm-span.html
 * @see https://www.elastic.co/guide/en/apm/guide/current/data-model-spans.html
 * @see https://github.com/elastic/apm-agent-nodejs/blob/v3.40.0/lib/instrumentation/span.js#L31
 */
export declare type Span = (
{
    timestamp: number // Timestamp holds the recorded time of the event, UTC based and formatted as microseconds since Unix epoch
} | {
    start: number // Start is the offset relative to the transaction's timestamp identifying the start of the span, in milliseconds.
}) & {

    action?: string // Action holds the specific kind of event within the sub-type represented by the span (e.g. query, connect)

    child_ids?: string[] // ChildIDs holds a list of successor transactions and/or spans.

    composite?: { // Composite holds details on a group of spans represented by a single one.
        compression_strategy: string // A string value indicating which compression strategy was used. The valid values are `exact_match` and `same_kind`.
        count: number // Count is the number of compressed spans the composite span represents. The minimum count is 2, as a composite span represents at least two spans.
        sum: number // Sum is the durations of all compressed spans this composite span represents in milliseconds.
    }

    context?: { // Context holds arbitrary contextual information for the event.

        db?: { // Database contains contextual data for database spans
            instance?: string // Instance name of the database.
            link?: string // Link to the database server.
            rows_affected?: number // RowsAffected shows the number of rows affected by the statement.
            statement?: string // Statement of the recorded database event, e.g. query.
            type?: string // Type of the recorded database event., e.g. sql, cassandra, hbase, redis.
            user?: string // User is the username with which the database is accessed.
        }

        destination?: { // Destination contains contextual data about the destination of spans
            address?: string // Address is the destination network address: hostname (e.g. 'localhost'), FQDN (e.g. 'elastic.co'), IPv4 (e.g. '127.0.0.1') IPv6 (e.g. '::1')
            port?: number // Port is the destination network port (e.g. 443)
            service?: { // Service describes the destination service
                name?: string // Name is the identifier for the destination service, e.g. 'http://elastic.co', 'elasticsearch', 'rabbitmq' ( DEPRECATED: this field will be removed in a future release
                resource: string // Resource identifies the destination service resource being operated on e.g. 'http://elastic.co:80', 'elasticsearch', 'rabbitmq/queue_name' DEPRECATED: this field will be removed in a future release
                type?: string // Type of the destination service, e.g. db, elasticsearch. Should typically be the same as span.type. DEPRECATED: this field will be removed in a future release
            }
        }

        http?: { // HTTP contains contextual information when the span concerns an HTTP request.
            method?: string // Method holds information about the method of the HTTP request.
            response?: { // Response describes the HTTP response information in case the event was created as a result of an HTTP request.
                decoded_body_size?: number // DecodedBodySize holds the size of the decoded payload.
                encoded_body_size?: number // EncodedBodySize holds the size of the encoded payload.
                headers?: {[key: string]: string | string[] | undefined} // Headers holds the http headers sent in the http response.
                status_code?: number // StatusCode sent in the http response.
                transfer_size?: number // TransferSize holds the total size of the payload.
            }
            status_code?: number // Deprecated: Use Response.StatusCode instead. StatusCode sent in the http response.
            url?: string // URL is the raw url of the correlating HTTP request.
        }

        message?: { // Message holds details related to message receiving and publishing if the captured event integrates with a messaging system
            age?: { // Age of the message. If the monitored messaging framework provides a timestamp for the message, agents may use it. Otherwise, the sending agent can add a timestamp in milliseconds since the Unix epoch to the message's metadata to be retrieved by the receiving agent. If a timestamp is not available, agents should omit this field.
                ms?: number // Age of the message in milliseconds.
            }
            body?: string // Body of the received message, similar to an HTTP request body
            headers?: {[key: string]: string | string[] | undefined} // Headers received with the message, similar to HTTP request headers.
            queue?: { // Queue holds information about the message queue where the message is received.
                name?: string // Name holds the name of the message queue where the message is received.
            }
            routing_key?: string // RoutingKey holds the optional routing key of the received message as set on the queuing system, such as in RabbitMQ.
        }

        service?: { // Service related information can be sent per span. Information provided here will override the more generic information retrieved from metadata, missing service fields will be retrieved from the metadata information.
            agent?: { // Agent holds information about the APM agent capturing the event.
                ephemeral_id?: string // EphemeralID is a free format ID used for metrics correlation by agents
                name?: string // Name of the APM agent capturing information.
                version?: string // Version of the APM agent capturing information.
            }
            environment?: string // Environment in which the monitored service is running, e.g. `production` or `staging`.
            framework?: { // Framework holds information about the framework used in the monitored service.
                name?: string // Name of the used framework
                version?: string // Version of the used framework
            }
            id?: string // ID holds a unique identifier for the service.
            language?: { // Language holds information about the programming language of the monitored service.
                name?: string // Name of the used programming language
                version?: string // Version of the used programming language
            }
            name?: string // Name of the monitored service.
            node?: { // Node must be a unique meaningful name of the service node.
                configured_name?: string // Name of the service node
            }
            origin?: { // Origin contains the self-nested field groups for service.
                id?: string // Immutable id of the service emitting this event.
                name?: string // Immutable name of the service emitting this event.
                version?: string // The version of the service the data was collected from.
            }
            runtime?: { // Runtime holds information about the language runtime running the monitored service
                name?: string // Name of the language runtime
                version?: string // Version of the language runtime
            },
            target?: { // Target holds information about the outgoing service in case of an outgoing event
                name: string // Immutable name of the target service for the event
            } | {
                type: string // Immutable type of the target service for the event
            }
            version?: string // Version of the monitored service.
        }
        tags?: {[key: string]: string | null | boolean | number | undefined } // Tags are a flat mapping of user-defined tags. On the agent side, tags are called labels. Allowed value types are string, boolean and number values. Tags are indexed and searchable.
    }

    duration: number // Duration of the span in milliseconds. When the span is a composite one, duration is the gross duration, including \"whitespace\" in between spans.

    id: string // ID holds the hex encoded 64 random bits ID of the event.

    links?: Array<{ // Links holds links to other spans, potentially in other traces.
        span_id?: string // SpanID holds the ID of the linked span.
        trace_id?: string // TraceID holds the ID of the linked span's trace.
    }>

    name: string // Name is the generic designation of a span in the scope of a transaction.

    otel?: { // OTel contains unmapped OpenTelemetry attributes.
        attributes?: {[key: string]: unknown} // Attributes hold the unmapped OpenTelemetry attributes.
        span_kind?: string // SpanKind holds the incoming OpenTelemetry span kind.
    }

    outcome?: "success" | "failure" | "unknown" // Outcome of the span: success, failure, or unknown. Outcome may be one of a limited set of permitted values describing the success or failure of the span. It can be used for calculating error rates for outgoing requests.

    parent_id: string // ParentID holds the hex encoded 64 random bits ID of the parent transaction or span.

    sample_rate?: number // SampleRate applied to the monitored service at the time where this span was recorded.

    stacktrace?: Array<({ // Stacktrace connected to this span event.
        classname: string // Classname of the frame.
    } | {
        filename: string // Filename is the relative name of the frame's file.
    }) & {
        function?: string // Function represented by the frame.
        abs_path?: string // AbsPath is the absolute path of the frame's file.
        lineno?: number // LineNumber of the frame.
        colno?: number // ColumnNumber of the frame.
        context_line?: string // ContextLine is the line from the frame's file.
        library_frame?: boolean // LibraryFrame indicates whether the frame is from a third party library.
        module?: string // Module to which the frame belongs to.
        post_context?: string[] // PostContext is a slice of code lines immediately before the line from the frame's file.
        pre_context?: string[] // PreContext is a slice of code lines immediately after the line from the frame's file.
        vars?: { [key: string]: unknown | undefined }  // Vars is a flat mapping of local variables of the frame.
    }>

    subtype?: string // Subtype is a further sub-division of the type (e.g. postgresql, elasticsearch)

    sync?: boolean // Sync indicates whether the span was executed synchronously or asynchronously.

    trace_id: string // TraceID holds the hex encoded 128 random bits ID of the correlated trace.

    transaction_id?: string // TransactionID holds the hex encoded 64 random bits ID of the correlated transaction.

    type: string // Type holds the span's type, and can have specific keywords within the service's domain (eg: 'request', 'backgroundjob', etc)
}

// ///////////////////////////////////////////////////////////////////////////
// Error

/**
 * @see https://github.com/elastic/apm-server/blob/v8.5.0/docs/spec/v2/error.json
 * @see https://www.elastic.co/guide/en/apm/server/current/exported-fields-apm-error.html
 * @see https://www.elastic.co/guide/en/apm/guide/current/data-model-errors.html
  */
 export declare type ErrorApm = ({ // errorEvent represents an error or a logged error message, captured by an APM agent in a monitored service.
    exception: ({ // Exception holds information about the original error. The information is language specific.
        message: string // Message contains the originally captured error message.
    } | {
        type: string // Type of the exception.
    }) & {
        attributes?: {[key: string]: unknown} // Attributes of the exception.
        cause?: Array<{[key: string]: unknown}> // Cause can hold a collection of error exceptions representing chained exceptions. The chain starts with the outermost exception, followed by its cause, and so on.
        code?: string | number // Code that is set when the error happened, e.g. database error code.
        handled?: boolean // Handled indicates whether the error was caught in the code or not.
        module?: string // Module describes the exception type's module namespace.
        stacktrace?: Array<({ // Stacktrace connected to this span event.
            classname: string // Classname of the frame.
        } | {
            filename: string // Filename is the relative name of the frame's file.
        }) & {
            function?: string // Function represented by the frame.
            abs_path?: string // AbsPath is the absolute path of the frame's file.
            lineno?: number // LineNumber of the frame.
            colno?: number // ColumnNumber of the frame.
            context_line?: string // ContextLine is the line from the frame's file.
            library_frame?: boolean // LibraryFrame indicates whether the frame is from a third party library.
            module?: string // Module to which the frame belongs to.
            post_context?: string[] // PostContext is a slice of code lines immediately before the line from the frame's file.
            pre_context?: string[] // PreContext is a slice of code lines immediately after the line from the frame's file.
            vars?: { [key: string]: unknown | undefined }  // Vars is a flat mapping of local variables of the frame.
        }>
    }
} | {
    log: { // Log holds additional information added when the error is logged.
        level?: string // Level represents the severity of the recorded log.
        logger_name?: string // LoggerName holds the name of the used logger instance.
        message: string // Message of the logged error. In case a parameterized message is captured, Message should contain the same information, but with any placeholders being replaced.
        param_message?: string // ParamMessage should contain the same information as Message, but with placeholders where parameters were logged, e.g. 'error connecting to %s'. The string is not interpreted, allowing differnt placeholders per client languange. The information might be used to group errors together.
        stacktrace?: Array<({ // Stacktrace connected to this span event.
            classname: string // Classname of the frame.
        } | {
            filename: string // Filename is the relative name of the frame's file.
        }) & {
            function?: string // Function represented by the frame.
            abs_path?: string // AbsPath is the absolute path of the frame's file.
            lineno?: number // LineNumber of the frame.
            colno?: number // ColumnNumber of the frame.
            context_line?: string // ContextLine is the line from the frame's file.
            library_frame?: boolean // LibraryFrame indicates whether the frame is from a third party library.
            module?: string // Module to which the frame belongs to.
            post_context?: string[] // PostContext is a slice of code lines immediately before the line from the frame's file.
            pre_context?: string[] // PreContext is a slice of code lines immediately after the line from the frame's file.
            vars?: { [key: string]: unknown | undefined }  // Vars is a flat mapping of local variables of the frame.
        }>
    }
}) & {
    context?: { // Context holds arbitrary contextual information for the event.

        cloud?: { // Cloud holds fields related to the cloud or infrastructure the events are coming from.
            origin?: { // Origin contains the self-nested field groups for cloud.
                account?: { // The cloud account or organization id used to identify different entities in a multi-tenant environment.
                    id?: string // The cloud account or organization id used to identify different entities in a multi-tenant environment.
                }
                provider?: string // Name of the cloud provider.
                region?: string // Region in which this host, resource, or service is located.
                service?: { // The cloud service name is intended to distinguish services running on different platforms within a provider.
                    name?: string // The cloud service name is intended to distinguish services running on different platforms within a provider.
                }
            }
        }

        custom?: {[key: string]: undefined} // Custom can contain additional metadata to be stored with the event. The format is unspecified and can be deeply nested objects. The information will not be indexed or searchable in Elasticsearch.


        message?: { // Message holds details related to message receiving and publishing if the captured event integrates with a messaging system
            age?: { // Age of the message. If the monitored messaging framework provides a timestamp for the message, agents may use it. Otherwise, the sending agent can add a timestamp in milliseconds since the Unix epoch to the message's metadata to be retrieved by the receiving agent. If a timestamp is not available, agents should omit this field.
                ms?: number // Age of the message in milliseconds.
            }
            body?: string // Body of the received message, similar to an HTTP request body
            headers?: {[key: string]: string | string[] | undefined} // Headers received with the message, similar to HTTP request headers.
            queue?: { // Queue holds information about the message queue where the message is received.
                name?: string // Name holds the name of the message queue where the message is received.
            }
            routing_key?: string // RoutingKey holds the optional routing key of the received message as set on the queuing system, such as in RabbitMQ.
        }

        page?: { // Page holds information related to the current page and page referers. It is only sent from RUM agents.
            referer?: string // Referer holds the URL of the page that 'linked' to the current page.
            url?: string // URL of the current page
        }

        request?: { // Request describes the HTTP request information in case the event was created as a result of an HTTP request.
            body?: {[key: string]: undefined} | string
            cookies?: {[key: string]: undefined} // Cookies used by the request, parsed as key-value objects.
            env?: {[key: string]: undefined} // Env holds environment variable information passed to the monitored service.
            headers?: {[key: string]: string | string[] | undefined} // Headers includes any HTTP headers sent by the requester. Cookies will be taken by headers if supplied.
            http_version?: string // HTTPVersion holds information about the used HTTP version.
            method: string // Method holds information about the method of the HTTP request.
            socket?: { // Socket holds information related to the recorded request, such as whether or not data were encrypted and the remote address.
                encrypted?: boolean // Encrypted indicates whether a request was sent as TLS/HTTPS request. DEPRECATED: this field will be removed in a future release.
                remote_address?: string // RemoteAddress holds the network address sending the request. It should be obtained through standard APIs and not be parsed from any headers like 'Forwarded'.
            }
            url?: { // URL holds information sucha as the raw URL, scheme, host and path.
                full?: string // Full, possibly agent-assembled URL of the request, e.g. https://example.com:443/search?q=elasticsearch#top.
                hash?: string // Hash of the request URL, e.g. 'top'
                hostname?: string // Hostname information of the request, e.g. 'example.com'.\"
                pathname?: string // Path of the request, e.g. '/search'
                port?: string | number // Port of the request, e.g. '443'. Can be sent as string or int.
                protocol?: string // Protocol information for the recorded request, e.g. 'https:'.
                raw?: string // Raw unparsed URL of the HTTP request line, e.g https://example.com:443/search?q=elasticsearch. This URL may be absolute or relative. For more details, see https://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html#sec5.1.2.
                search?: string // Search contains the query string information of the request. It is expected to have values delimited by ampersands.
            }
        }

        response?: { // Response describes the HTTP response information in case the event was created as a result of an HTTP request.
            decoded_body_size?: number // DecodedBodySize holds the size of the decoded payload.
            encoded_body_size?: number // EncodedBodySize holds the size of the encoded payload.
            finished?: boolean // Finished indicates whether the response was finished or not.
            headers?: {[key: string]: string | string[] | undefined} // Headers holds the http headers sent in the http response.
            headers_sent?: boolean // HeadersSent indicates whether http headers were sent.
            status_code?: number // StatusCode sent in the http response.
            transfer_size?: number // TransferSize holds the total size of the payload.
        }

        service?: { // Service related information can be sent per event. Information provided here will override the more generic information retrieved from metadata, missing service fields will be retrieved from the metadata information.
            agent?: { // Agent holds information about the APM agent capturing the event.
                ephemeral_id?: string // EphemeralID is a free format ID used for metrics correlation by agents
                name?: string // Name of the APM agent capturing information.
                version?: string // Version of the APM agent capturing information.
            }
            environment?: string // Environment in which the monitored service is running, e.g. `production` or `staging`.
            framework?: { // Framework holds information about the framework used in the monitored service.
                name?: string // Name of the used framework
                version?: string // Version of the used framework
            }
            id?: string // ID holds a unique identifier for the service.
            language?: { // Language holds information about the programming language of the monitored service.
                name?: string // Name of the used programming language
                version?: string // Version of the used programming language
            }
            name?: string // Name of the monitored service.
            node?: { // Node must be a unique meaningful name of the service node.
                configured_name?: string // Name of the service node
            }
            origin?: { // Origin contains the self-nested field groups for service.
                id?: string // Immutable id of the service emitting this event.
                name?: string // Immutable name of the service emitting this event.
                version?: string // The version of the service the data was collected from.
            }
            runtime?: { // Runtime holds information about the language runtime running the monitored service
                name?: string // Name of the language runtime
                version?: string // Version of the language runtime
            },
            target?: { // Target holds information about the outgoing service in case of an outgoing event
                name: string // Immutable name of the target service for the event
            } | {
                type: string // Immutable type of the target service for the event
            }
            version?: string // Version of the monitored service.
        }

        tags?: {[key: string]: string | null | boolean | number | undefined } // Tags are a flat mapping of user-defined tags. On the agent side, tags are called labels. Allowed value types are string, boolean and number values. Tags are indexed and searchable.

        user?: { // User holds information about the correlated user for this event. If user data are provided here, all user related information from metadata is ignored, otherwise the metadata's user information will be stored with the event.
            domain?: string // Domain of the logged in user
            email?: string // Email of the user.
            id?: string | number // ID identifies the logged in user, e.g. can be the primary key of the user
            username?: string // Name of the user
        }
    }

    culprit?: string // Culprit identifies the function call which was the primary perpetrator of this event.

    id: string // ID holds the hex encoded 128 random bits ID of the event.

    parent_id?: string // ParentID holds the hex encoded 64 random bits ID of the parent transaction or span.

    timestamp?: number // Timestamp holds the recorded time of the event, UTC based and formatted as microseconds since Unix epoch.

    trace_id?: string // TraceID holds the hex encoded 128 random bits ID of the correlated trace.

    transaction?: { // Transaction holds information about the correlated transaction.
        name?: string // Name is the generic designation of a transaction in the scope of a single service, eg: 'GET /users/:id'.
        sampled?: boolean // Sampled indicates whether or not the full information for a transaction is captured. If a transaction is unsampled no spans and less context information will be reported.
        type?: string // Type expresses the correlated transaction's type as keyword that has specific relevance within the service's domain, eg: 'request', 'backgroundjob'.
    }

    transaction_id?: string // TransactionID holds the hex encoded 64 random bits ID of the correlated transaction.
}

// ///////////////////////////////////////////////////////////////////////////
// MetricSet

/**
 * @see https://github.com/elastic/apm-server/blob/v8.5.0/docs/spec/v2/metricset.json
 */
 export declare type MetricSet = {
    
    faas?: { // FAAS holds fields related to Function as a Service events.
        coldstart?: boolean // Indicates whether a function invocation was a cold start or not.
        execution?: string // The request id of the function invocation.
        id?: string // A unique identifier of the invoked serverless function.
        name?: string // The lambda function name.
        trigger?: { // Trigger attributes.
            request_id?: string // The id of the origin trigger request.
            type?: string // The trigger type.
        }
        version?: string // The lambda function version.
    }
    
    samples: { // Samples hold application metrics collected from the agent.
        [key: string]: ({
            value: number // Value holds the value of a single metric sample.
        } | {
            values: number[] // Values holds the bucket values for histogram metrics. Values must be provided in ascending order; failure to do so will result in the metric being discarded.
        }) & {
            counts?: number[] // "Counts holds the bucket counts for histogram metrics.  These numbers must be positive or zero.  If Counts is specified, then Values is expected to be specified with the same number of elements, and with the same order.
            type?: string // Type holds an optional metric type: gauge, counter, or histogram.  If Type is unknown, it will be ignored.
            unit?: string // Unit holds an optional unit for the metric.  - \"percent\" (value is in the range [0,1]) - \"byte\" - a time unit: \"nanos\", \"micros\", \"ms\", \"s\", \"m\", \"h\", \"d\"  If Unit is unknown, it will be ignored.
        }
    }
    
    service?: { // Service holds selected information about the correlated service.
        name?: string // Name of the correlated service.
        version?: string // Version of the correlated service.
    }

    span?: { // Span holds selected information about the correlated transaction.
        subtype?: string // Subtype is a further sub-division of the type (e.g. postgresql, elasticsearch)
        type?: string // Type expresses the correlated span's type as keyword that has specific relevance within the service's domain, eg: 'request', 'backgroundjob'.
    }
    
    tags?: {[key: string]: string | null | boolean | number | undefined } // Tags are a flat mapping of user-defined tags. On the agent side, tags are called labels. Allowed value types are string, boolean and number values. Tags are indexed and searchable.

    timestamp?: number // Timestamp holds the recorded time of the event, UTC based and formatted as microseconds since Unix epoch
    
    transaction?: { // Transaction holds selected information about the correlated transaction.
        name?: string // Name of the correlated transaction.
        type?: string // Type expresses the correlated transaction's type as keyword that has specific relevance within the service's domain, eg: 'request', 'backgroundjob'.
    }
}

// ///////////////////////////////////////////////////////////////////////////
// Client

declare class Client {

  public constructor(opts: Options)

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientconfigoptions */
  public config(opts: OptionsForConfigFuction): void

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientsupportskeepingunsampledtransaction */
  public supportsKeepingUnsampledTransaction(): bool

  /**
  * Add a filter function used to filter the "metadata" object sent to APM
  * server. See the APM Agent `addMetadataFilter` documentation for details.
  * @see https://www.elastic.co/guide/en/apm/agent/nodejs/current/agent-api.html#apm-add-metadata-filter
  * @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientaddmetadatafilterfn
  */
  public addMetadataFilter(fn: (md: any) => any): void

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientsetextrametadatametadata */
  public setExtraMetadata(extraMetadata: {[key: string]: unknown}): void

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientlambdastart */
  public lambdaStart(): void

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientsendspanspan-callback */
  public sendSpan(span: Span, cb?: Callback): boolean | undefined

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientsendtransactiontransaction-callback */
  public sendTransaction(transaction: Transaction, cb?: Callback): boolean | undefined

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientsenderrorerror-callback */
  public sendError(error: ErrorApm, cb?: Callback): boolean | undefined

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientsendmetricsetmetricset-callback */
  public sendMetricSet(metricset: MetricSet, cb?: Callback): boolean | undefined

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientflushcallback */
  public flush(cb?: Callback): boolean | undefined

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientendcallback */
  public end(cb?: Callback): void

  /** @see https://github.com/elastic/apm-nodejs-http-client/blob/v11.0.2/README.md#clientdestroy */
  public destroy(): void
}

// ///////////////////////////////////////////////////////////////////////////
// export
