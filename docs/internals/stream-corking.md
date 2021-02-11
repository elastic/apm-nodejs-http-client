# Stream Corking

As discussed elsewhere, the Elastic Node.js Agent's HTTP Client is a writable stream object.  One advanced streaming feature the client uses [is Node.js stream corking](https://nodejs.org/api/stream.html#stream_writable_cork).

We use stream corking to solve two independent challenges.  The first is to delay writes to the downstream stream chopper object until the client is 100% ready to send data.  The second is to prevent what Node.js calls "head-of-line blocking" issues, when the writing of individual objects downstream can creating blocking code situations.

This document will describe both scenarios, as well as provide a basic primer on Node.js stream corking.

## Stream Corking

One way of looking at a Node.js Writable stream object is as an API that

1. Allows a client programmer to _write_ data to an object
2. Allows a stream programmer to take programatic action when that data is written

If we consider streams from that point of view, stream corking will _delay_ the programatic action that happens when data's written to a stream.  It will delay this action until the stream is uncorked.

### Sample Program

Consider this sample program.

```javascript
    // File: sample.js
    const fs = require('fs')
    const { Stream } = require('stream')

    // a non-async logger function to make our
    // order of operations more objects
    function syncLog(message) {
      fs.writeSync(process.stdout.fd, message)
      fs.writeSync(process.stdout.fd, "\n")
    }

    class MyStream extends Stream.Writable {
      _write (chunk, encoding, callback) {
        syncLog(chunk.toString())
        callback()
      }
    }

    const s = new MyStream
    syncLog('starting our for loop')
    for(let i=0;i<10;i++) {
      s.write(`on loop number ${i}`)
    }
    syncLog('done with our for loop')
```


Here we have a simple _Hello World_ stream object.  Run it, and we see data logged via the `_write` method of the stream object.


    % node sample.js
    starting our for loop
    on loop number 0
    on loop number 1
    on loop number 2
    on loop number 3
    on loop number 4
    on loop number 5
    on loop number 6
    on loop number 7
    on loop number 8
    on loop number 9
    done with our for loop

However --- if we _cork_ that stream before writing and then _uncork_ after our for loop.

    const fs = require('fs')
    const { Stream } = require('stream')

    // a non-async logger function to make our
    // order of operations more objects
    function syncLog(message) {
      fs.writeSync(process.stdout.fd, message)
      fs.writeSync(process.stdout.fd, "\n")
    }

    class MyStream extends Stream.Writable {
      _write (chunk, encoding, callback) {
        syncLog(chunk.toString())
        callback()
      }
    }

    const s = new MyStream

    // NEW: corking the stream
    s.cork()
    syncLog('starting our for loop')
    for(let i=0;i<10;i++) {
      s.write(`on loop number ${i}`)
    }
    syncLog('done with our for loop')

    // NEW: un-corking the stream
    s.uncork()

and run the program

    % node /tmp/sample.js
    starting our for loop
    done with our for loop
    on loop number 0
    on loop number 1
    on loop number 2
    on loop number 3
    on loop number 4
    on loop number 5
    on loop number 6
    on loop number 7
    on loop number 8
    on loop number 9

We can see that Node.js does not call `_write` until after the stream's been uncorked.

### _writev method

The full benefit of stream corking isn't apparent until we consider what happens when a stream is uncorked.  When we cork a stream, data starts to accumulate inside that stream object.  When we uncork that stream, there will be _multiple_ objects to write out.  In our example above, this meant ten individual calls to the `_write` method.

The Node.js stream APIs include a feature that allows the stream programmer to take programatic action on _all_ the buffered data in a stream at once.  If a stream object implements the `_writev` method, Node.js will call this method _instead_ of calling `_write` _when there's data backed up in a stream_.  Node.js will also pass `_writev` an array of _all_ the data.

The `_writev` method allows a stream programmer to write more efficient stream objects.  First, a single call to `_writev` (vs. individual calls to `write`) is fewer method calls overall --- which can add up for a busy stream.  Additionally, `_writev` allows a stream programmer to act on large sets of data _all at once_.  Batching large sets of data like this can often lead to better performance --- although the specifics will depend on the code an individual stream programmer writes.

The main tradeoff of `_writev` is in code complexity.  A stream can implement `_write`, `_writev`, or both.  It's up to the client programmer to ensure each of these methods behaves is a similar/reasonable way.

This article won't get too into _how_ the client object uses `_write` and `_writev` --- we're more inserted in how stream corking delays calls to these methods.

## Stream Corking and Agent Initialization

To understand to first use case of stream corking in the client we need to understand how the client is instantiated, as well as understand the metadata that the  agent/client needs to collect before it can send data to APM Server.

The APM Server APIs requires that each request begins with a metadata object.  This metadata contains information about the running agent instance.  Collecting some of this data, like the service name, is as simple as inspecting the agent's configuration.  Collecting data other data, however, requires us to query the local server environment in an asynchronous fashion.

This means the client can't send data to APM Server right away.  The client currently uses stream corking to buffer data in the client until these asynchronous network requests are finished.

Specifically, in the client's constructor function, [we `cork` the stream](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L100), make our asynchronous network request [via the `_fetchAndEncodeMetadata` function](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L101), and then [uncork the stream once this request has finished](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L106).

```javascript
  this.cork()
  this._fetchAndEncodeMetadata(() => {
    // _fetchAndEncodeMetadata will have set/memoized the encoded
    // metadata to the _encodedMetadata property.

    // this uncork reverse the .cork call in the constructor (above)
    this.uncork()

    // the `cloud-metadata` event allows listeners to know when the
    // agent has finished fetching and encoding its metadata for the
    // first time
    this.emit('cloud-metadata', this._encodedMetadata)
  })
```

 We also [_refuse_ to uncork the stream](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L350) until this metadata is present in the `_encodedMetadata` property.

The effectively blocks data from being written to the stream chopper until these network requests finish.  Once the `_encodedMetadata` property is set, this specific instance of stream corking will not be invoked again.

## Data Buffering

The second way we use corking is to buffer our stream writes. Data is never immediately written to the stream chopper object.  Instead, the client stream will repeatedly

1. Cork itself
2. After a _period of time or activity_, uncork itself.
3. (This triggers a data write to the stream chopper)
4. `GOTO 1`

There are two agent configuration values the control the _period of time or activity_.

    bufferWindowTime
    bufferWindowSize

The first, `bufferWindowTime`, allows us to configure a time limit for how often the client stream will uncork itself.  The default is 20 milliseconds.

The second, `bufferWindowSize`, allows us to configure a _how many objects_ the client stream will hold on to before uncorking itself.  The default is 50 objects.

The `bufferWindowSize` configuration will supersede the `bufferWindowTime` configuration.  In other words, with a default configuration, if the stream receives 51 objects in 10 milliseconds, the stream will uncork itself and the timer will be reset to 20 milliseconds.

## Detailed Corking Logic

The Elastic HTTP Client offers an API for sending data to APM Server.  Specifically, there are four methods --- `sendSpan`, `sendTransaction`, `sendError`, and `sendMetricSet`.

The implementation of these methods [looks like this](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L391) .

```javascript
Client.prototype.sendSpan = function (span, cb) {
  this._maybeCork()
  return this.write({ span }, Client.encoding.SPAN, cb)
}

Client.prototype.sendTransaction = function (transaction, cb) {
  this._maybeCork()
  return this.write({ transaction }, Client.encoding.TRANSACTION, cb)
}

Client.prototype.sendError = function (error, cb) {
  this._maybeCork()
  return this.write({ error }, Client.encoding.ERROR, cb)
}

Client.prototype.sendMetricSet = function (metricset, cb) {
  this._maybeCork()
  return this.write({ metricset }, Client.encoding.METRICSET, cb)
}
```

Prior to writing the span, transaction, error, or metricset data to itself, the HTTP client calls its `_maybeCork` method.

If the stream is _not_ currently corked, the `_maybeCork` method will [cork the stream](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L333), and [create a timer with a callback](https://github.com/elastic/apm-nodejs-http-client/blob/b992ef5a0a1eba3a2690cd275acb88938174c8fa/index.js#L338) that will uncork the stream.

```javascript
    Client.prototype._maybeCork = function () {
      if (!this._writableState.corked && this._conf.bufferWindowTime !== -1) {
        this.cork()
        if (this._corkTimer && this._corkTimer.refresh) {
          // the refresh function was added in Node 10.2.0
          // if refresh is avaiable and the timer object is still
          // here, just reuse it rather than create a new timer
          this._corkTimer.refresh()
        } else {
          this._corkTimer = setTimeout(() => {
            this.uncork()
          }, this._conf.bufferWindowTime)
        }
      } else if (this._writableState.length >= this._conf.bufferWindowSize) {
        this._maybeUncork()
      }
    }
```

If the stream _is_ currently corked _and_ the number of objects written to the stream has reached the threshold set in the `bufferWindowSize` configuration, then we will uncork the stream via a call to `_maybeUncork`.

```
Client.prototype._maybeUncork = function () {
  if (this._writableState.corked) {
    // Wait till next tick, so that the current write that triggered the call
    // to `_maybeUncork` have time to be added to the queue. If we didn't do
    // this, that last write would trigger a single call to `_write`.
    process.nextTick(() => {
      if (this.destroyed === false) this.uncork()
    })

    if (this._corkTimer) {
      clearTimeout(this._corkTimer)
      this._corkTimer = null
    }
  }
}
```

There's two things worth noting here.  The first --- uncorking the stream also means clearing the previously set cork timeout, effectively resetting the cork timer.

The second thing worth noting is that the `_maybeUncork` method does not uncork data immediately. Instead it schedules the uncorking via a `nextTick` callback.  By delaying the call to `uncork` this gives the current call to `write` a chance to add its data to the stream _before_ the stream is uncorked.  The tradeoff for this benefit is some potential for _interesting_ timing issues if other code has scheduled callbacks via `nextTick` in the current asynchronous context and those callbacks run instrumented code.

