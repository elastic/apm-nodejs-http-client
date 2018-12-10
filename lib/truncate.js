'use strict'

var breadthFilter = require('breadth-filter')
var truncate = require('unicode-byte-truncate')

exports.metadata = truncMetadata
exports.transaction = truncTransaction
exports.span = truncSpan
exports.error = truncError
exports.metricset = truncMetricSet

function truncMetadata (metadata, opts) {
  breadthFilter(metadata, (value, key, path) => {
    if (typeof value !== 'string') {
      return value
    }

    let max = opts.truncateStringsAt
    switch (path[0]) {
      case 'service':
        switch (path[1]) {
          case 'name':
          case 'version':
          case 'environment':
            max = opts.truncateKeywordsAt
            break

          case 'agent':
          case 'framework':
          case 'language':
          case 'runtime':
            switch (path[2]) {
              case 'name':
              case 'version':
                max = opts.truncateKeywordsAt
                break
            }
            break
        }
        break

      case 'process':
        if (path[1] === 'title') {
          max = opts.truncateKeywordsAt
        }
        break

      case 'system':
        switch (path[1]) {
          case 'architecture':
          case 'hostname':
          case 'platform':
            max = opts.truncateKeywordsAt
            break
        }
        break
    }

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

      case 'id':
      case 'trace_id':
      case 'parent_id':
        max = opts.truncateKeywordsAt
        break

      case 'context':
        max = contextLength(path, opts)
        break
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

      case 'id':
      case 'trace_id':
      case 'parent_id':
      case 'transaction_id':
      case 'subtype':
      case 'action':
        max = opts.truncateKeywordsAt
        break

      case 'context':
        max = contextLength(path, opts)
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
      case 'id':
      case 'trace_id':
      case 'parent_id':
      case 'transaction_id':
        max = opts.truncateKeywordsAt
        break

      case 'context':
        max = contextLength(path, opts)
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
            } else {
              return value
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
            } else {
              return value
            }
            break
        }
        break
    }

    return truncate(value, max)
  }, true)
}

function truncMetricSet (metricset, opts) {
  breadthFilter(metricset, (value, key, path) => {
    if (typeof value !== 'string') {
      return value
    }

    let max = path[0] === 'tags'
      ? opts.truncateKeywordsAt
      : opts.truncateStringsAt

    return truncate(value, max)
  }, true)
}

function contextLength (path, opts) {
  switch (path[1]) {
    case 'db':
      if (path[2] === 'statement') {
        return opts.truncateQueriesAt
      }
      break

    case 'request':
      switch (path[2]) {
        case 'method':
        case 'http_version':
          return opts.truncateKeywordsAt

        case 'url':
          switch (path[3]) {
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
          break
      }
      break

    case 'user':
      switch (path[2]) {
        case 'id':
        case 'email':
        case 'username':
          return opts.truncateKeywordsAt
      }
      break

    case 'tags':
      return opts.truncateKeywordsAt

    default:
      return opts.truncateStringsAt
  }
}
