#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
start_iso="$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)"
remote_dir="/tmp/smartcity-submission-$timestamp"
remote_archive="/tmp/smartcity-submission-$timestamp.tar.gz"
local_archive="$repo_root/exports/smartcity-submission-$timestamp.tar.gz"
manifest="$repo_root/exports/EXPORT_MANIFEST-$timestamp.json"

mkdir -p "$repo_root/exports"
docker compose exec -T mongo rm -rf "$remote_dir"
docker compose exec -T mongo mkdir -p "$remote_dir"

docker compose exec -T mongo mongosh smartcity --quiet --eval "
const start = new Date('$start_iso');
print(JSON.stringify({
  exportedAt: new Date(),
  database: 'smartcity',
  rawTrafficStart: start,
  rawTrafficCount: db.traffic_observations.countDocuments({observedAt: {\$gte: start}}),
  rawRainfallCount: db.rainfall_observations.countDocuments({obsTime: {\$gte: start}}),
  detectorCatalogCount: db.traffic_detector_catalog.countDocuments(),
  traffic15mCount: db.traffic_detector_15m.countDocuments(),
  trafficLatestCount: db.traffic_latest.countDocuments(),
  trafficRoadHourlyCount: db.traffic_road_hourly.countDocuments(),
  rainfall15mCount: db.rainfall_15m.countDocuments(),
  trafficWeather15mCount: db.traffic_weather_15m.countDocuments(),
  ingestionRunsCount: db.ingestion_runs.countDocuments(),
  retention: {
    rawTrafficDays: 8,
    rawRainfallDays: 30,
    ingestionRunsDays: 30
  }
}, null, 2));
" > "$manifest"

docker compose exec -T mongo mongodump --db smartcity \
  --collection traffic_observations \
  --query "{\"observedAt\":{\"\$gte\":{\"\$date\":\"$start_iso\"}}}" \
  --gzip --out="$remote_dir"

docker compose exec -T mongo mongodump --db smartcity \
  --collection rainfall_observations \
  --query "{\"obsTime\":{\"\$gte\":{\"\$date\":\"$start_iso\"}}}" \
  --gzip --out="$remote_dir"

for collection in \
  traffic_detector_catalog \
  traffic_detector_15m \
  traffic_latest \
  traffic_road_hourly \
  rainfall_15m \
  traffic_weather_15m \
  ingestion_runs
do
  docker compose exec -T mongo mongodump --db smartcity \
    --collection "$collection" \
    --gzip --out="$remote_dir"
done

docker compose cp "$manifest" "mongo:$remote_dir/EXPORT_MANIFEST.json"
docker compose exec -T mongo tar -czf "$remote_archive" -C "$remote_dir" .
docker compose cp "mongo:$remote_archive" "$local_archive"
(
  cd "$repo_root/exports"
  sha256sum "$(basename "$local_archive")" > "SHA256-$(basename "$local_archive").txt"
)

echo "Submission dataset: $local_archive"
echo "Manifest: $manifest"

