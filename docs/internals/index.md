# Elastic APM Node.js HTTP Client Internals

The following documents describe some of the private APIs and architecture used in this client.  The code discussed here is not considered a public API.  These routines are  implementation details that may change and shift over time irrespective of the client's current semantic version.    

The primary intent of these documents is to give developers and engineers who want to work on features a map of the territory.  

- [Client Streams](./client-streams.md)
- [Client Streams and Corking](./stream-corking.md)

Don't see what you're looking for?  [Let us know](https://github.com/elastic/apm-nodejs-http-client/issues) which system you're trying to understand and what sort of questions you have. 