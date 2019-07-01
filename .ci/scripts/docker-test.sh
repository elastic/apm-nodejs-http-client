#!/usr/bin/env bash
set -xueo pipefail

export
id
node --version
npm --version
npm install
npm list

# Let's store the test output in the target folder
TARGET_FOLDER=target
mkdir -p target
nyc npm test | tee ${TARGET_FOLDER}/test-suite-output.tap
nyc report --report-dir=./${TARGET_FOLDER}/coverage --reporter=lcov | tee ${TARGET_FOLDER}/coverage.lcov
