#!/bin/sh
# Redeploy: pull latest master and rebuild containers. Run on the VPS inside the project dir.
set -eu

cd "$(dirname "$0")/.."

git pull --ff-only origin master
docker compose up -d --build
docker image prune -f
