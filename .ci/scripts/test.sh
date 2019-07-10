#!/usr/bin/env bash
set -exo pipefail

DOCKER_FOLDER=.ci/docker
NODE_VERSION=${1:?Nodejs version missing NODE_VERSION is not set}
DOCKER_COMPOSE_FILE=docker-compose-node-test.yml

NODE_VERSION=${NODE_VERSION} TAV_VERSIONS=${TAV_VERSIONS} USER_ID="$(id -u):$(id -g)" docker-compose \
  --no-ansi \
  --log-level ERROR \
  -f ${DOCKER_FOLDER}/${DOCKER_COMPOSE_FILE} \
  up \
  --exit-code-from node_tests \
  --build \
  --remove-orphans \
  --abort-on-container-exit \
  node_tests
NODE_VERSION=${NODE_VERSION} docker-compose \
  --no-ansi \
  --log-level ERROR \
  -f ${DOCKER_FOLDER}/${DOCKER_COMPOSE_FILE} \
  down -v
