#!/usr/bin/env bash
set -xueo pipefail

HOME=/tmp
PATH=${PATH}:$(pwd)/node_modules/.bin:${HOME}/.npm-global/bin
export NPM_CONFIG_PREFIX=~/.npm-global
npm install -g tap-junit

# Let's store the test output in the target folder
TARGET_FOLDER=target

for tf in "${TARGET_FOLDER}"/*-output.tap
do
  [[ -e "$tf" ]] || break  # handle the case of no *.wav files
  filename=$(basename "${tf}" ${TARGET_FOLDER}/output.tap)
  if [ -s "${tf}" ]; then
    tap-junit --package="Agent Node.js" > "${TARGET_FOLDER}/junit-${filename}-report.xml" < "${tf}" || true
  fi
done

for jf in "${TARGET_FOLDER}"/junit-*-report.xml
do
  [[ -e "$jf" ]] || break  # handle the case of no *.wav files
  if [ -f "${jf}" ] && [ ! -s "${jf}" ]; then
    rm "${jf}"
  fi
done

exit 0
