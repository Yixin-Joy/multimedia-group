# Hong Kong Weather and Traffic Collector

This repository contains a reproducible Node-RED and MongoDB environment for continuous collection of Hong Kong traffic-speed and rainfall open data. A team member can clone the repository, run Docker Compose, and immediately start with both the saved data snapshot and the current Node-RED flow.

## Included

- Node-RED flow with traffic, weather, catalog, retry, and MongoDB integrations
- MongoDB 7 database with the latest local data snapshot
- Automatic seed restore on first MongoDB initialization
- Automatic Node-RED flow loading on first startup
- Deterministic upsert keys to prevent repeated polling from creating duplicates
- Data indexes for time-series queries
- A complete [data dictionary](DATA_DICTIONARY.md)
- The three-person Dashboard design and assignment plan in [TEAM_WORK_PLAN.md](TEAM_WORK_PLAN.md)

## Start

Requirements:

- Docker Desktop on Windows or macOS, or Docker Engine with the Compose plugin on Linux
- Git
- Outbound HTTPS access to `data.gov.hk`, `resource.data.one.gov.hk`, and `data.weather.gov.hk`

Clone and start:

```bash
git clone https://github.com/Yixin-Joy/multimedia-group.git
cd multimedia-group
docker compose up -d --build
```

Node-RED is bound to localhost only:

```text
http://localhost:1880
```

MongoDB is also bound to localhost:

```text
mongodb://127.0.0.1:27017/smartcity
```

The first startup can take several minutes while Docker downloads images and restores the seed archive.

## What happens automatically

On a fresh MongoDB data volume:

1. `mongo-init/000-restore-seed.sh` restores `smartcity-seed.archive.gz`.
2. `mongo-init/001-create-indexes.js` ensures query indexes exist.
3. MongoDB becomes healthy.

On a fresh Node-RED data volume:

1. The custom image places `node-red-data/flows.json` in `/data/flows.json`.
2. Node-RED starts and initializes the `mongodb4` palette node.
3. The flow immediately runs once, then continues on its configured schedule.

The seed snapshot contains:

| Collection | Documents |
|---|---:|
| `traffic_observations` | 314,804 |
| `rainfall_observations` | 936 |
| `traffic_detector_catalog` | 807 |

See [DATA_DICTIONARY.md](DATA_DICTIONARY.md) for field definitions and aggregation recommendations.

## Architecture

```text
DATA.GOV.HK transportation API ─┐
                                ├─ Node-RED ─ MongoDB smartcity
Hong Kong Observatory API ──────┘
```

The MongoDB seed is imported only when its named volume is initialized. Changing the seed archive later does not overwrite an existing database automatically.

## Collection schedule

| Data | Source | Schedule |
|---|---|---|
| Traffic speed, volume, and occupancy | `rawSpeedVol-all.xml` | Every 5 minutes |
| Detector location catalog | `traffic_speed_volume_occ_info.csv` | Every hour |
| Rainfall in the past hour | HKO `hourlyRainfall.php` | Every 10 minutes |

Failed HTTP requests are retried after 30 seconds.

## MongoDB collections

| Collection | Purpose |
|---|---|
| `traffic_observations` | Raw detector-lane observations |
| `traffic_detector_catalog` | Road, district, direction, and coordinate metadata |
| `rainfall_observations` | Automatic weather station rainfall observations |

Raw observations are retained so the cleaning rules can be revised without collecting everything again.

## Verify the stack

Windows PowerShell:

```powershell
.\tools\check_collection.ps1
```

Linux or macOS:

```bash
./tools/check_collection.sh
```

Or inspect containers and collections directly:

```bash
docker compose ps
docker compose exec -T mongo mongosh smartcity --quiet \
  --eval "db.getCollectionNames()"
docker compose logs --tail 100 node-red
```

Expected collections:

```text
rainfall_observations
traffic_detector_catalog
traffic_observations
```

## Stop and restart

Stop containers while preserving data:

```bash
docker compose down
```

Restart later:

```bash
docker compose up -d
```

Do not use `docker compose down -v` unless you explicitly want to delete the databases and restore the repository seed on the next startup.

## Reset to the repository snapshot

This removes all data written after the seed snapshot and restores the included snapshot:

```bash
docker compose down -v
docker compose up -d --build
```

## Export the latest data

Create a transferable database archive:

```bash
docker compose exec -T mongo mongodump \
  --db smartcity \
  --gzip \
  --archive=/tmp/smartcity-latest.archive.gz

docker compose cp mongo:/tmp/smartcity-latest.archive.gz \
  ./smartcity-latest.archive.gz
```

Restore it into another checkout:

```bash
docker compose cp ./smartcity-latest.archive.gz \
  mongo:/tmp/smartcity-latest.archive.gz

docker compose exec -T mongo mongorestore \
  --gzip \
  --drop \
  --archive=/tmp/smartcity-latest.archive.gz \
  --nsInclude="smartcity.*"
```

## Update the committed seed

Replace `mongo-init/smartcity-seed.archive.gz`, regenerate its checksum, and record the new snapshot in `DATA_DICTIONARY.md`.

On Windows PowerShell:

```powershell
(Get-FileHash '.\mongo-init\smartcity-seed.archive.gz' -Algorithm SHA256).Hash
```

On Linux or macOS:

```bash
sha256sum mongo-init/smartcity-seed.archive.gz
```

## Update the Node-RED flow

`node-red-data/flows.json` is the committed flow loaded into a fresh `node-red-state` volume.

After editing in the browser:

1. Deploy the flow.
2. Export the complete flow from Node-RED.
3. Replace `node-red-data/flows.json`.
4. Commit the new flow.

To force an existing local environment to use the committed flow, recreate just the Node-RED state volume:

```bash
docker compose down
docker volume rm multimedia-group_node-red-state
docker compose up -d --build
```

The volume name may include a different Compose project prefix. Check it with:

```bash
docker volume ls | grep node-red-state
```

## Data quality rules

- Exclude `valid=false` traffic rows.
- Exclude speeds outside 0-200 km/h.
- Exclude occupancy outside 0-100 percent.
- Require positive volume before classifying a zero-speed row as congestion.
- Treat rainfall `M` as missing, not zero.
- Treat rainfall `T` as trace with numeric value zero.
- Convert UTC timestamps to Hong Kong time only in presentation layers.
- Never interpret weather correlation as causation.

See [DATA_DICTIONARY.md](DATA_DICTIONARY.md) for the complete field-level schema.

## Troubleshooting

### Node-RED container restarts with `/data` permission errors

This repository uses a Docker named volume, so no host UID mapping is required. If you migrate to a bind mount, ensure the container UID 1000 can write the mounted directory.

### MongoDB starts but the seed is missing

Initialization scripts run only on a fresh volume. Check:

```bash
docker compose down -v
docker compose up -d --build
```

### DNS errors in the flow

The flow retries failed HTTP requests after 30 seconds. Confirm from the Docker host:

```bash
docker compose exec node-red \
  node -e "fetch('https://data.weather.gov.hk/weatherAPI/opendata/hourlyRainfall.php?lang=en').then(r=>console.log(r.status)).catch(console.error)"
```

## Official sources

- [Traffic Data of Strategic / Major Roads](https://data.gov.hk/en-data/dataset/hk-td-sm_4-traffic-data-strategic-major-roads)
- [Rainfall in the past hour](https://data.gov.hk/en-data/dataset/hk-hko-rss-rainfall-in-the-past-hour)
- [DATA.GOV.HK](https://data.gov.hk/)

