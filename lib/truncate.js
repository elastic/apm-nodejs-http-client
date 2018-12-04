'use strict'

var breadthFilter = require('breadth-filter')
var truncate = require('unicode-byte-truncate')

exports.metadata = truncMetadata
exports.transaction = truncTransaction
exports.span = truncSpan
exports.error = truncError

function truncMetadata (metadata, opts) {
  metadata.process.title = truncate(String(metadata.process.title), opts.truncateKeywordsAt)

  // Truncate any remaining strings
  breadthFilter(metadata, (value, key, path) => {
    if (typeof value !== 'string') return value
    if (path.join('.') === 'process.title') return value
    return truncate(value, 1024)
  }, true)
}

function truncTransaction (trans, opts) {
  trans.name = truncate(String(trans.name), opts.truncateKeywordsAt)
  trans.type = truncate(String(trans.type), opts.truncateKeywordsAt)
  trans.result = truncate(String(trans.result), opts.truncateKeywordsAt)

  // Unless sampled, context will be null
  if (trans.sampled) truncContext(trans.context, opts.truncateKeywordsAt)

  // Truncate any remaining strings
  breadthFilter(trans, (value, key, path) => {
    if (typeof value !== 'string') return value
    if (path[0] === 'context') {
      return value
    }
    switch (path.join('.')) {
      case 'name':
      case 'type':
      case 'result':
        return value
    }
    return truncate(value, 1024)
  }, true)
}

function truncSpan (span, opts) {
  span.name = truncate(String(span.name), opts.truncateKeywordsAt)
  span.type = truncate(String(span.type), opts.truncateKeywordsAt)
  if (span.stacktrace) span.stacktrace = truncFrames(span.stacktrace, opts.truncateSourceLinesAt)

  // Truncate any remaining strings
  breadthFilter(span, (value, key, path) => {
    if (typeof value !== 'string') return value
    if (path[0] === 'stacktrace') {
      return value
    }
    switch (path.join('.')) {
      case 'name':
      case 'type':
        return value
      case 'context.db.statement':
        return truncate(value, 10000)
    }
    return truncate(value, 1024)
  }, true)
}

function truncError (error, opts) {
  if (error.log) {
    if (error.log.level) {
      error.log.level = truncate(String(error.log.level), opts.truncateKeywordsAt)
    }
    if (error.log.logger_name) {
      error.log.logger_name = truncate(String(error.log.logger_name), opts.truncateKeywordsAt)
    }
    if (error.log.message && opts.truncateErrorMessagesAt >= 0) {
      error.log.message = truncate(String(error.log.message), opts.truncateErrorMessagesAt)
    }
    if (error.log.param_message) {
      error.log.param_message = truncate(String(error.log.param_message), opts.truncateKeywordsAt)
    }
    if (error.log.stacktrace) {
      error.log.stacktrace = truncFrames(error.log.stacktrace, opts.truncateSourceLinesAt)
    }
  }

  if (error.exception) {
    if (error.exception.message && opts.truncateErrorMessagesAt >= 0) {
      error.exception.message = truncate(String(error.exception.message), opts.truncateErrorMessagesAt)
    }
    if (error.exception.type) {
      error.exception.type = truncate(String(error.exception.type), opts.truncateKeywordsAt)
    }
    if (error.exception.code) {
      error.exception.code = truncate(String(error.exception.code), opts.truncateKeywordsAt)
    }
    if (error.exception.module) {
      error.exception.module = truncate(String(error.exception.module), opts.truncateKeywordsAt)
    }
    if (error.exception.stacktrace) {
      error.exception.stacktrace = truncFrames(error.exception.stacktrace, opts.truncateSourceLinesAt)
    }
  }

  truncContext(error.context, opts.truncateKeywordsAt)

  // Truncate any remaining strings
  breadthFilter(error, (value, key, path) => {
    if (typeof value !== 'string') return value
    if (path[0] === 'context') {
      return value
    }
    if (path[0] === 'log') {
      if (path[1] === 'stacktrace') {
        return value
      }
      switch (path[1]) {
        case 'level':
        case 'logger_name':
        case 'message':
        case 'param_message':
          return value
      }
    }
    if (path[0] === 'exception') {
      if (path[1] === 'stacktrace') {
        return value
      }
      switch (path[1]) {
        case 'message':
        case 'type':
        case 'code':
        case 'module':
          return value
      }
    }
    return truncate(value, 1024)
  }, true)
}

function truncContext (context, max) {
  if (!context) return

  if (context.request) {
    if (context.request.method) {
      context.request.method = truncate(String(context.request.method), max)
    }
    if (context.request.url) {
      if (context.request.url.protocol) {
        context.request.url.protocol = truncate(String(context.request.url.protocol), max)
      }
      if (context.request.url.hostname) {
        context.request.url.hostname = truncate(String(context.request.url.hostname), max)
      }
      if (context.request.url.port) {
        context.request.url.port = truncate(String(context.request.url.port), max)
      }
      if (context.request.url.pathname) {
        context.request.url.pathname = truncate(String(context.request.url.pathname), max)
      }
      if (context.request.url.search) {
        context.request.url.search = truncate(String(context.request.url.search), max)
      }
      if (context.request.url.hash) {
        context.request.url.hash = truncate(String(context.request.url.hash), max)
      }
      if (context.request.url.raw) {
        context.request.url.raw = truncate(String(context.request.url.raw), max)
      }
      if (context.request.url.full) {
        context.request.url.full = truncate(String(context.request.url.full), max)
      }
    }
  }
  if (context.user) {
    if (context.user.id) {
      context.user.id = truncate(String(context.user.id), max)
    }
    if (context.user.email) {
      context.user.email = truncate(String(context.user.email), max)
    }
    if (context.user.username) {
      context.user.username = truncate(String(context.user.username), max)
    }
  }

  // Truncate any remaining strings
  breadthFilter(context, (value, key, path) => {
    if (typeof value !== 'string') return value
    if (path[0] === 'request') {
      if (path[1] === 'method') {
        return value
      }
      if (path[1] === 'url') {
        switch (path[2]) {
          case 'protocol':
          case 'hostname':
          case 'port':
          case 'pathname':
          case 'search':
          case 'hash':
          case 'raw':
          case 'full':
            return value
        }
      }
    }
    if (path[0] === 'user') {
      switch (path[1]) {
        case 'id':
        case 'email':
        case 'username':
          return value
      }
    }
    return truncate(value, 1024)
  }, true)
}

function truncFrames (frames, max) {
  frames.forEach(function (frame, i) {
    if (frame.pre_context) frame.pre_context = truncEach(frame.pre_context, max)
    if (frame.context_line) frame.context_line = truncate(String(frame.context_line), max)
    if (frame.post_context) frame.post_context = truncEach(frame.post_context, max)

    // Truncate any remaining strings
    breadthFilter(frame, (value, key, path) => {
      if (typeof value !== 'string') return value

      switch (path[0]) {
        case 'pre_context':
        case 'context_line':
        case 'post_context':
          return value
      }

      return truncate(value, 1024)
    }, true)
  })

  return frames
}

function truncEach (arr, len) {
  return arr.map(function (str) {
    return truncate(String(str), len)
  })
}
