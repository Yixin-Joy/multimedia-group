#!/bin/bash
set -euo pipefail

single_seed="/docker-entrypoint-initdb.d/smartcity-seed.archive.gz"
parts_directory="/docker-entrypoint-initdb.d/seed-parts"
combined_seed="/tmp/smartcity-seed.archive.gz"
expected_sha256="a6fc9f12294c93c551d8e60262fa4a312d45733b6343e477a34d2f337482fb5b"

if [ -f "$single_seed" ]; then
  seed="$single_seed"
elif compgen -G "$parts_directory/smartcity-seed.part-*" > /dev/null; then
  echo "Combining split smartcity seed data"
  cat "$parts_directory"/smartcity-seed.part-* > "$combined_seed"
  seed="$combined_seed"

  actual_sha256="$(sha256sum "$seed" | awk '{print $1}')"
  if [ "$actual_sha256" != "$expected_sha256" ]; then
    echo "Seed checksum mismatch: expected $expected_sha256, got $actual_sha256" >&2
    exit 1
  fi
else
  echo "No smartcity seed archive or split parts found"
  exit 0
fi

if [ -s "$seed" ]; then
  echo "Restoring smartcity seed data from $seed"
  mongorestore \
    --gzip \
    --archive="$seed" \
    --nsInclude="smartcity.*"
  echo "Seed restore completed"
fi

if [ -f "$combined_seed" ]; then
  rm -f "$combined_seed"
fi

