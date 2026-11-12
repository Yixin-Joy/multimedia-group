#!/usr/bin/env bash
set -euo pipefail

docker compose exec -T mongo mongosh smartcity --quiet --eval '
const names = [
  "traffic_observations",
  "traffic_detector_catalog",
  "rainfall_observations",
  "ingestion_runs",
  "traffic_detector_15m",
  "traffic_latest",
  "traffic_road_hourly",
  "rainfall_15m",
  "traffic_weather_15m",
];
print(JSON.stringify(names.map((collection) => ({
  collection,
  documents: db.getCollection(collection).countDocuments(),
})), null, 2));
'

