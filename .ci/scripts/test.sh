#!/usr/bin/env bash
set -eo pipefail

NODE_VERSION=${1:?Nodejs version missing NODE_VERSION is not set}

## If the nvm has not been installed yet locally or in the CI then let's install it.
if ! command -v nvm; then
  echo 'Installing nvm'
  curl --silent -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
  source "${HOME}/.nvm/nvm.sh"
fi

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
