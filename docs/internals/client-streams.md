Node.js APM Agent HTTP Client Streams
=====================================

When the Elastic Node.js agent sends data to the
[apm-nodejs-http-client](https://github.com/elastic/apm-nodejs-http-client),
this starts a process where the data will pass through *three* Node.js
stream objects before finally being piped into a HTTP(S) request stream
(for four streams total). This request stream sends the data on the APM
server

```
           Node.js Agent     
                 ↓
    [ apm-nodejs-http-client ] 
                 ↓
    [     stream-chopper     ]    
                 ↓
    [      zlib stream       ]
                 ↓
    [     request stream     ]
                 ↓
            APM Server    
```

The intent of this document is to describe the lifecycle of a piece of
agent data from first being written to the client stream all the way to
the point it's sent to the APM Server via a Node.js request object.

What is a Stream?
-----------------

A stream is a Node.js object that allows a client-programmer to write
data to an object. This allows the stream programmer to take
programmatic action based on the data being written to the stream.
Streams have many uses, but they're most commonly used to provide memory
efficient data processing and transformation.

Consider this simple program

```javascript
    const { Stream } = require('stream')
    const strem = require('stream')

    class MyStream extends Stream.Writable {
      _write (chunk, encoding, callback) {
        console.log('START: _write')
        console.log(chunk.toString())
        console.log(encoding)
        console.log('END: _write')
        callback()
      }
    }

    const s = new MyStream
    s.write('hello stream')
```

The `MyStream` class allows us to create a stream object that we can
write data to. The MyStream object can take action whenever data is
written to this stream.

Streams can do way more than what this simple program does. If you want
to learn more [the official
docs](https://nodesource.com/blog/understanding-streams-in-nodejs/) and
[this
NodeSource](https://nodesource.com/blog/understanding-streams-in-nodejs/)
article are good places to get started.

For our purposes we'll discuss additional stream features as they come
up.

Elastic's Node.js APM Client Streams
------------------------------------

Let's look at our stream diagram again

```
           Node.js Agent     
                 ↓
    [ apm-nodejs-http-client ] 
                 ↓
    [     stream-chopper     ]    
                 ↓
    [      zlib stream       ]
                 ↓
    [     request stream     ]
                 ↓
            APM Server        
```

That's four distinct stream objects between the agent and the APM Server
instance. There's the apm-nodejs-http-client itself, which is the
Writable stream where data originates. There's a stream called the
stream-chopper. There's a zlib stream that accepts uncompressed data and
writes compressed data back out. Finally, there's a Node.js HTTP
request, which is also a stream.

Let's look at each stream object independently.

### apm-nodejs-http-client

Whenever the Elastic Agent wants to send a piece of data to APM Server,
it will first call a method on the apm-nodejs-http-client object. You
can see an example [of this
here](https://github.com/elastic/apm-agent-nodejs/blob/3c2505b5f299381f09409500b4f0108dbb01ba38/lib/instrumentation/index.js#L241),
with the agent calling the sendSpan method of the apm-nodejs-http-client
object.

```javascript
      if (agent._transport) agent._transport.sendSpan(payload)
```

If you take a look at [the definition of
sendSpan](https://github.com/elastic/apm-nodejs-http-client/blob/7f352b2181533435eee11d9da4d41a15ac607851/index.js#L348)
we see that the apm-nodejs-http-client (Client below) will write to
itself.

```javascript
    Client.prototype.sendSpan = function (span, cb) {
      this._maybeCork()
      return this.write({ span }, Client.encoding.SPAN, cb)
    }
```

This apm-nodejs-http-client serves as an API/interface between the Agent
and the APM Server, but it's also a stream object.

When processing the data that's been written to it, the Client will
write data to a second stream, known as the stream-chopper.

### stream-chopper

So what [is the
stream-chopper](https://www.npmjs.com/package/stream-chopper)? It's
another stream object with some extra behavior.

The stream-chopper

1.  Accepts data from a source stream

2.  Creates a **new** destination-stream

3.  Writes data to this new destination-stream

4.  If the amount of data written reaches a threshold, the
    stream-chopper will close and destroy the destination-stream object,
    and then create a new destination-stream

5.  If the stream-chopper writes data to a stream past a
    time limit, the stream-chopper will close and destroy the
    destination-stream object, and then create a new destination-stream

6.  Also, if the destination-stream is closed for any other reason, the
    stream-chopper will create a new destination-stream

7.  Whenever the stream-chopper creates a new destination-stream, it
    emits a stream event

So, if we consider a portion of our stream diagram

```
    [stream-chopper] -> [zlib stream] -> [request]
```

the following is a more accurate representation of what's going on

```
                     / ---> [zlib stream] -> [request]
    [stream-chopper] -----> [zlib stream] -> [request]
                     \ ---> [zlib stream] -> [request]

```

Over the lifetime of an agent process, the stream-chopper will be
constantly creating new streams to write data to whenever something ends
its destination-stream. However, the stream chopper should only ever
have one destination-stream active at time.

The apm-nodejs-http-client object instantiates the stream-chopper [in
its
constructor](https://github.com/elastic/apm-nodejs-http-client/blob/7f352b2181533435eee11d9da4d41a15ac607851/index.js#L95).
The stream-chopper is intended to be a long lived single instance object.

```javascript
    this._chopper = new StreamChopper({
        size: this._conf.size,
        time: this._conf.time,
        type: StreamChopper.overflow,
        transform () {
          return zlib.createGzip()
        }
    }).on('stream', onStream(this, errorproxy))
```   

### zib stream

The zlib stream is a destination-stream object created by the
stream-chopper. The zlib stream is what's known as [a Transform
stream](https://nodejs.org/api/stream.html#stream_class_stream_transform).
It accepts data in one form (uncompressed), and will write data back out
in another form (compressed via zlib)

The stream-chopper creates a zlib destination-stream because we've told
it to. When we configure the stream-chopper, we included a transform
function.

```javascript
    this._chopper = new StreamChopper({
        size: this._conf.size,
        time: this._conf.time,
        type: StreamChopper.overflow,
        transform () {
          return zlib.createGzip()
        }
    }).on('stream', onStream(this, errorproxy))
```  

By adding this transform function as an argument to the stream-chopper's
constructor, this allows us to define a function that creates the
stream-chopper's destination stream.

### HTTP Request

Whenever a stream-chopper object creates a new zlib destination-stream,
the stream-chopper emits a stream event. When the client instantiates a
stream-chopper object, it also [sets up a listener for this
event](https://github.com/elastic/apm-nodejs-http-client/blob/7f352b2181533435eee11d9da4d41a15ac607851/index.js#L102)

```javascript
    // ...

    }).on('stream', onStream(this, errorproxy))
    
    // ...
    
    function onStream (client, onerror) {
      return function (stream, next) {    
        //... stream listener ...
      }
    }

    // ...
```

This listener is where we instantiate the HTTP request to the APM
server. This request object is our our final stream

```javascript
    // `_transport` is either a `require('http')` or `require('https')`
    const req = client._transport.request(client._conf.requestIntake, onResult(onerror))
```

Both the http and https modules in Node.js provide a low level
streamable interfaces for making HTTP requests. The request object
returned by this call to `_transport.request` is a stream object.

Next, the listener function [will
pipe](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
the data from the zlib stream to the req stream. This means the
compressed data that the zlib stream is writing will be written to the
req stream. In other words --- the compressed data coming out of the zlib
stream will be sent to the APM Server.

Pump vs. Pipe
-------------

Stream piping is [a built-in feature of the Node.js stream
library](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options).
Stream piping is one of the advanced streaming features we mentioned
earlier --- it allows you to automatically send the output of one stream
into another stream.

The apm-nodejs-http-client does not *directly* use the stream's pipe
method. Instead [we
use](https://github.com/elastic/apm-nodejs-http-client/blob/7f352b2181533435eee11d9da4d41a15ac607851/index.js#L457)
a [library named pump](https://www.npmjs.com/package/pump)

```
pump(stream, req, function () {
    // callback invoked when the streams ends
})
```

The pump function will pipe one stream to another. Pump's special
feature is if the destination-stream closes for any reason, **pump will
also close and automatically destroy the source stream**.

This means when the req to the APM Server finishes, pump will also
end/close/destroy the zlib stream created by the stream-chopper.

When this happens, the stream-chopper will create a new zlib stream.

When the stream-chopper creates a new zlib stream it issues a stream
event.

The apm-nodejs-http-client's stream listener will hear this event and
fire its callback --- which will create a new request starting the whole
process over again.

All this leaves one thing unanswered: What ends the HTTP request stream?

Request Ending
--------------

There's two ways an HTTP request to the APM server might naturally end.
The first is the stream-chopper's stream timeout. The second is via the
generic server timeout variable.

### Stream Timeout/Closing

Earlier we mentioned one feature of the stream-chopper was

> If the stream-chopper writes data to a stream passed a configured
> time limit, the stream-chopper will close and destroy the
> destination-stream object, and then create a new destination-stream

The stream-chopper has [[a time
limit]{.ul}](https://github.com/elastic/apm-nodejs-http-client/blob/7f352b2181533435eee11d9da4d41a15ac607851/index.js#L97)
on how long it will write to any destination-stream. In the agent, the
[`apiRequestTime`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#api-request-time)
sets this time limit. This means that, by default, every stream-chopper
destination-stream will be kept open for 10 seconds.

This *also* means that every request stream will be kept open for 10
seconds. That's because of the pump library. The pump library ensures **whenever** the
destination-stream closes that the request stream will close as well.

### Server Timeout

The agent also has a
[`serverTimeout`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#server-timeout)
configuration variable. This setting offers a generic request timeout for the client.

This configuration value will be converted into milliseconds and [passed on to the request](https://github.com/elastic/apm-nodejs-http-client/blob/cac3e9f47d7fd4e9c3894f52e5ed17b04e58eec1/index.js#L452) object's 
[`setTimeout`](https://nodejs.org/api/http.html#http_request_settimeout_timeout_callback) method.

```javascript
    if (Number.isFinite(client._conf.serverTimeout)) {
      req.setTimeout(client._conf.serverTimeout, function () {
        req.destroy(new Error(`APM Server response timeout (${client._conf.serverTimeout}ms)`))
      })
    }
```

One interesting thing to note: With an agent's default configuration
values, this second
[`serverTimeout`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#server-timeout)
will rarely be reached since its default (of 30 seconds) is less than
the
[`apiRequestTime`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#api-request-time)
default (of 10 seconds).

The
[`serverTimeout`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#server-timeout)
value exists to handle cases where both the zlib destination-stream and
the request stream have ended, but the client is still waiting for APM
Server to respond to and end the HTTP request. Under ideal conditions
APM Server will respond and end the HTTP request right away, but since
we can't rely on the behavior of APM Server in non-ideal conditions, the
[`serverTimeout`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#server-timeout)
configuration value serves as an escape hatch to ensure the HTTP request
is not held open potentially forever. Without this escape hatch, an
overwhelmed APM Server might result in a lot of active HTTP requests
waiting to finish. This in turn means that the Node.js HTTP Agent keeps
opening new TCP sockets to accommodate new HTTP requests, instead of
reusing the existing open TCP sockets - essentially leaking memory and
resources.

In practice this means this
[`serverTimeout`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#server-timeout)
value should always be configured to a value that's larger than the
[`apiRequestTime`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#api-request-time)
value. With a value less than
[`apiRequestTime`](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#api-request-time)
the client will destroy the HTTP request stream before it finishes
sending its data.
