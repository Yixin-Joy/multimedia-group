$ErrorActionPreference = "Stop"

$query = @'
const names = [
  "traffic_observations",
  "traffic_detector_catalog",
  "rainfall_observations"
];
print(JSON.stringify(names.map((name) => ({
  collection: name,
  documents: db.getCollection(name).countDocuments()
})), null, 2));
'@

docker compose exec -T mongo mongosh smartcity --quiet --eval $query


