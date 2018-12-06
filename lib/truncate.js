'use strict'

var breadthFilter = require('breadth-filter')
var truncate = require('unicode-byte-truncate')

exports.metadata = truncMetadata
exports.transaction = truncTransaction
exports.span = truncSpan
exports.error = truncError

function truncMetadata (metadata, opts) {
  breadthFilter(metadata, (value, key, path) => {
    if (typeof value !== 'string') {
      return value
    }

    const max = path[0] === 'process' && path[1] === 'title'
      ? opts.truncateKeywordsAt
      : opts.truncateStringsAt

    return truncate(value, max)
  }, true)
}

function truncTransaction (trans, opts) {
  trans.name = truncate(String(trans.name), opts.truncateKeywordsAt)
  trans.type = truncate(String(trans.type), opts.truncateKeywordsAt)
  trans.result = truncate(String(trans.result), opts.truncateKeywordsAt)

  breadthFilter(trans, (value, key, path) => {
    if (typeof value !== 'string') {
      return value
    }

    let max = opts.truncateStringsAt
    switch (path[0]) {
      case 'name':
      case 'type':
      case 'result':
        return value
      case 'context':
        if (trans.sampled) {
          max = contextLength(path.slice(1), opts)
        }
    }

    return truncate(value, max)
  }, true)
}

function truncSpan (span, opts) {
  span.name = truncate(String(span.name), opts.truncateKeywordsAt)
  span.type = truncate(String(span.type), opts.truncateKeywordsAt)

  breadthFilter(span, (value, key, path) => {
    if (typeof value !== 'string') {
      return value
    }

    let max = opts.truncateStringsAt
    switch (path[0]) {
      case 'name':
      case 'type':
        return value
      case 'context':
        if (path[1] === 'db' && path[2] === 'statement') {
          max = opts.truncateQueriesAt
        }
        break
    }

    return truncate(value, max)
  }, true)
}

function truncError (error, opts) {
  breadthFilter(error, (value, key, path) => {
    if (typeof value !== 'string') {
      return value
    }

    let max = opts.truncateStringsAt
    switch (path[0]) {
      case 'context':
        max = contextLength(path.slice(1), opts)
        break

      case 'log':
        switch (path[1]) {
          case 'level':
          case 'logger_name':
          case 'param_message':
            max = opts.truncateKeywordsAt
            break
          case 'message':
            if (opts.truncateErrorMessagesAt >= 0) {
              max = opts.truncateErrorMessagesAt
            }
            break
        }
        break

      case 'exception':
        switch (path[1]) {
          case 'type':
          case 'code':
          case 'module':
            max = opts.truncateKeywordsAt
            break
          case 'message':
            if (opts.truncateErrorMessagesAt >= 0) {
              max = opts.truncateErrorMessagesAt
            }
            break
        }
        break
    }

    return truncate(value, max)
  }, true)
}

function contextLength (path, opts) {
  if (path[0] === 'request') {
    if (path[1] === 'method') {
      return opts.truncateKeywordsAt
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
          return opts.truncateKeywordsAt
      }
    }
  }
  if (path[0] === 'user') {
    switch (path[1]) {
      case 'id':
      case 'email':
      case 'username':
        return opts.truncateKeywordsAt
    }
  }
  return opts.truncateStringsAt
}
