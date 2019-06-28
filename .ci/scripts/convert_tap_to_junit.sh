#!/usr/bin/env bash
set -xueo pipefail

HOME=/tmp
PATH=${PATH}:$(pwd)/node_modules/.bin:${HOME}/.npm-global/bin
export NPM_CONFIG_PREFIX=~/.npm-global
npm install -g tap-junit

# Let's store the test output in the target folder
TARGET_FOLDER=target

for tf in $(ls ${TARGET_FOLDER}/*-output.tap)
do
  filename=$(basename ${tf} ${TARGET_FOLDER}/output.tap)
  if [ -s ${tf} ]; then
    cat ${tf}|tap-junit --package="Agent Node.js" > ${TARGET_FOLDER}/junit-${filename}-report.xml || true
  fi
done

for jf in $(ls ${TARGET_FOLDER}/junit-*-report.xml)
do
  if [ -f ${jf} ] && [ ! -s ${jf} ]; then
    rm ${jf}
  fi
done

exit 0
