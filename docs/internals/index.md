# Elastic APM Node.js HTTP Client Internals

The following documents describe some of the APIs and architecture that implement agent fields internally.  These features are not considered a public API -- they are implementation details that may change and shift over time irrespective of the client's current semantic version.    

The primary intent of these documents is to give developers and engineers who want to work an agent features a map of the territory.  

- [Client Streams](./client-streams.md)
- [Client Streams and Corking](./stream-corking.md)

Don't see what you're looking for?  [Let us know](https://github.com/elastic/apm-nodejs-http-client/issues) which system you're trying to understand and what sort of questions you have. 