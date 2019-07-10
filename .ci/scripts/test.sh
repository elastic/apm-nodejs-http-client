#!/usr/bin/env bash
set -exo pipefail

NODE_VERSION=${1:?Nodejs version missing NODE_VERSION is not set}

TARGET_FOLDER=target

mkdir -p ${TARGET_FOLDER}

nvm install "${NODE_VERSION}"
node --version
npm --version
nvm --version
npm install
npm test | tee ${TARGET_FOLDER}/test-suite-output.tap
npm run coverage

## nyc report --report-dir=./${TARGET_FOLDER}/coverage --reporter=lcov | tee ${TARGET_FOLDER}/coverage.lcov
