#!/bin/bash
#
# Run each test/*.test.js file in a separate process.
#

TOP=$(cd $(dirname $0)/../ >/dev/null; pwd)

ls $TOP/test/*.test.js | while read f; do
    echo ""
    echo "# runnign 'node $f'"
    node $f
done
