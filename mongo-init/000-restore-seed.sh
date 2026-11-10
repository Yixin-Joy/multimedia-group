#!/bin/bash
set -euo pipefail

seed="/docker-entrypoint-initdb.d/smartcity-seed.archive.gz"

if [ -f "$seed" ]; then
  echo "Restoring smartcity seed data from $seed"
  mongorestore \
    --gzip \
    --archive="$seed" \
    --nsInclude="smartcity.*"
  echo "Seed restore completed"
fi

