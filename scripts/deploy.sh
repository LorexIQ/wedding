#!/bin/sh
# Redeploy: pull latest master and refresh containers. Run on the VPS inside the project dir.
# Containers are stopped first — the VPS doesn't have headroom to run the old containers
# and build/pull the new image at the same time (site is down for the refresh duration).
#
# Modes:
#   ./deploy.sh build   - build the image locally from source (needs build headroom, slow on small VPS)
#   ./deploy.sh pull     - pull the prebuilt image from GHCR (built by CI on push to master)
# Defaults to "pull" since the image is built in CI.
set -eu

cd "$(dirname "$0")/.."

MODE="${1:-pull}"

git pull --ff-only origin master
docker compose down

case "$MODE" in
  build)
    docker compose up -d --build
    ;;
  pull)
    docker compose pull app
    docker compose up -d
    ;;
  *)
    echo "Usage: $0 [build|pull]" >&2
    exit 1
    ;;
esac

docker image prune -f
