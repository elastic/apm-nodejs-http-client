'use strict'

exports.context = function (context) {
  if (!context) return

  if (context.request) stringifyHeaders(context.request.headers)
  if (context.response) stringifyHeaders(context.response.headers)
}

// Ensure all values in the headers object are either strings or array of strings
function stringifyHeaders (headers) {
  if (!headers) return

  for (const key in headers) {
    const value = headers[key]
    if (typeof value === 'string') continue
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string') {
          value.splice(i, 1, String(value[i]))
        }
      }
    } else {
      headers[key] = String(value)
    }
  }
}
