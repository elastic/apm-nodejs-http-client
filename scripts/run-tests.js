/*
 * Copyright Elasticsearch B.V. and other contributors where applicable.
 * Licensed under the BSD 2-Clause License; you may not use this file except in
 * compliance with the BSD 2-Clause License.
 */

'use strict'

// Run all "test/**/*.test.js" files, each in a separate process.

var fs = require('fs')
var path = require('path')
var spawn = require('child_process').spawn

var glob = require('glob')

// ---- support functions

// Run a single test file.
function runTestFile (testFile, cb) {
  console.log(`# running test: node ${testFile}`)
  var ps = spawn('node', [testFile], { stdio: 'inherit' })
  ps.on('error', cb)
  ps.on('close', function (code) {
    if (code !== 0) {
      const err = new Error('non-zero error code')
      err.code = 'ENONZERO'
      err.exitCode = code
      return cb(err)
    }
    cb()
  })
}

function series (tasks, cb) {
  var results = []
  var pos = 0

  function done (err, result) {
    if (err) return cb(err)
    results.push(result)

    if (++pos === tasks.length) {
      cb(null, results)
    } else {
      tasks[pos](done)
    }
  }

  setImmediate(tasks[pos], done)
}

function handlerBind (handler) {
  return function (task) {
    return handler.bind(null, task)
  }
}

function mapSeries (tasks, handler, cb) {
  series(tasks.map(handlerBind(handler)), cb)
}

// ---- mainline

function main () {
  var testFiles = glob.sync(
    // Find all ".test.js" files, except those in "fixtures" dirs and in
    // "node_modules" dirs created for test packages.
    'test/**/*.test.js',
    { ignore: ['**/node_modules/**', '**/fixtures/**'] }
  )

  mapSeries(testFiles, runTestFile, function (err) {
    if (err) throw err
  })
}

main()
