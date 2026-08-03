#!/bin/sh
# Redeploy: pull latest master and rebuild containers. Run on the VPS inside the project dir.
# Containers are stopped before the build — the VPS doesn't have headroom to run the old
# containers and build the new image at the same time (site is down for the build duration).
set -eu

cd "$(dirname "$0")/.."

git pull --ff-only origin master
docker compose down
docker compose up -d --build
docker image prune -f
