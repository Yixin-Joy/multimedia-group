$ErrorActionPreference = "Stop"

$query = @'
const names = [
  "traffic_observations",
  "traffic_detector_catalog",
  "rainfall_observations",
  "ingestion_runs",
  "traffic_detector_15m",
  "traffic_latest",
  "traffic_road_hourly",
  "rainfall_15m",
  "traffic_weather_15m"
];
print(JSON.stringify(names.map((name) => ({
  collection: name,
  documents: db.getCollection(name).countDocuments()
})), null, 2));
'@

docker compose exec -T mongo mongosh smartcity --quiet --eval $query


