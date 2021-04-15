#!/usr/bin/env bash
set -eo pipefail

NODE_VERSION=${1:?Nodejs version missing NODE_VERSION is not set}

## If the nvm has not been installed yet locally or in the CI then let's install it.
if ! command -v nvm; then
  echo 'Installing nvm'
  curl --silent -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
  # shellcheck source=/dev/null
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
