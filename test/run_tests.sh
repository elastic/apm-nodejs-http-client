#!/bin/bash
#
# Run each test/*.test.js file in a separate process.
#

EXIT_CODE=0
TOP=$(cd $(dirname $0)/../ >/dev/null; pwd)
runTest() {
    echo ""
    echo "# running 'node $1'"
    node $1 || EXIT_CODE=$?
}

for i in $TOP/test/*.test.js; do
    runTest $i
done
exit $EXIT_CODE
