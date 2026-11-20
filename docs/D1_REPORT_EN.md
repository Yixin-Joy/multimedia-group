# D1 Report Draft: Data Collection and System Implementation

Draft date: 20 November 2026

This draft covers the data sources, system design, storage model, cleaning process, and data retention policy. It is written for integration into the group report. The figures in the draft snapshot are not final. They must be updated after the data is frozen on 29 November 2026.

## 3. Data Sources and Acquisition

### 3.1 Source selection

The project uses public data from DATA.GOV.HK and the Hong Kong Observatory. We selected two data streams that can be joined by time. The first stream describes traffic speed on major roads. The second stream describes rainfall at automatic weather stations. Together, they allow the dashboard to compare road conditions with recent weather.

The original proposal mentioned the Traffic Speed Map. In practice, the live Traffic Speed Map is mainly supplied as PNG images. A picture cannot provide clean speed values for analysis. We therefore used the Transport Department's structured traffic detector feed under the same traffic use case. The feed provides speed, volume, occupancy, lane, and detector fields.

The parking idea was dropped after the project scope was reduced to weather and traffic. Its collection flow and MongoDB collections were removed.

### 3.2 Selected sources

Table 3.1 lists the source data used in the implementation.

| Data | Provider | Format | Collection frequency | Main use |
|---|---|---|---|---|
| Major road traffic detector data | Transport Department | XML | Every 5 minutes | Speed, volume, and occupancy |
| Detector location and road catalog | Transport Department | CSV | Every hour | Road name, district, direction, and coordinates |
| Rainfall in the past hour | Hong Kong Observatory | JSON | Every 10 minutes | Rain conditions and weather grouping |

The traffic feed is available at:

`https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol-all.xml`

The detector catalog is available at:

`https://static.data.gov.hk/td/traffic-data-strategic-major-roads/info/traffic_speed_volume_occ_info.csv`

The rainfall feed is available at:

`https://data.weather.gov.hk/weatherAPI/opendata/hourlyRainfall.php?lang=en`

The traffic data covers strategic and major roads. It does not cover every road in Hong Kong. The current catalog contains 807 detectors across 19 districts. The weather feed contains 36 automatic weather stations.

### 3.3 Collection process

Node-RED sends HTTP requests to each source. The returned XML or JSON is converted into a normal JavaScript object. A function node then checks the fields, converts numeric values, and creates one MongoDB operation for each observation.

Traffic records are stored at lane level. Each record includes the source date and the start of its 30-second period. The system also stores the collection time, so the source time and fetch time can be compared later.

Weather records are stored at station level. The source values `M`, `T`, and numeric rainfall are handled separately. `M` means that the reading is missing. `T` means that there was only a trace of rain. A numeric value is stored as millimetres.

The detector catalog is refreshed every hour. This keeps road names, directions, districts, and map coordinates up to date without adding duplicate catalog rows.

## 4. System Architecture

### 4.1 Components

The system uses Node-RED for data collection and analysis, MongoDB for storage, and Docker Compose for deployment. The services run in separate containers and communicate through a private Docker network.

Figure 4.1 shows the main data path.

```text
DATA.GOV.HK traffic API ─┐
                         ├─ Node-RED ─ MongoDB ─ Analytical collections ─ Dashboard
HKO rainfall API ────────┘
```

[Insert Figure 4.1: System architecture diagram.]

Node-RED has three responsibilities. It fetches the source data, cleans and aggregates the records, and serves the traffic dashboard through read-only HTTP routes. MongoDB stores both the original records and the cleaned data used by the dashboard.

Docker Compose makes the project easy to run on another machine. A team member can clone the repository and start the stack with one command. The first startup creates the Node-RED state, restores the MongoDB snapshot, and creates the required indexes.

### 4.2 Collection flow

The collection flow has three scheduled branches. Traffic runs every five minutes. Weather runs every ten minutes. The detector catalog runs every hour.

Each branch sends its data to a MongoDB write node. The system does not simply insert every response. It creates a stable `_id` for each observation and uses an upsert operation. If the same source snapshot is received again, the existing record is matched and no duplicate row is added.

HTTP failures are sent to retry branches. The affected request is retried after 30 seconds. This matters because short DNS errors and cross-border network issues can happen. A retry keeps a temporary failure from creating a long gap in the data.

[Insert Figure 4.2: Node-RED collection and cleaning flow screenshot.]

### 4.3 Storage layers

The database is split into three logical layers.

The raw layer keeps source observations. These collections are `traffic_observations`, `rainfall_observations`, and `traffic_detector_catalog`. Raw records are useful for checking data quality and rebuilding analytical data.

The aggregate layer keeps cleaned data. The main collections are `traffic_detector_15m`, `traffic_latest`, `traffic_road_hourly`, `rainfall_15m`, and `traffic_weather_15m`. These collections are smaller and faster to query than the raw traffic table.

The monitoring layer is `ingestion_runs`. It records each traffic and weather collection attempt. Each run stores the source time, fetch time, attempted rows, inserted rows, duplicate rows, and status.

This separation keeps the dashboard fast. The interface does not need to scan millions of raw lane records for every chart.

## 5. Data Storage, Cleaning and Retention

### 5.1 Traffic cleaning

The raw traffic feed contains some values that should not be used directly. A record must first pass the source validity flag. Its speed must be between 0 and 200 km/h. Its occupancy must be between 0 and 100 percent. These rules remove impossible values and obvious source errors.

The feed stores one row for each lane. This creates too much detail for a road-level dashboard. We group lane rows by detector and 15-minute time bucket. The detector speed is weighted by lane volume:

```text
detector speed = sum(lane speed × lane volume) / sum(lane volume)
```

If a detector has no positive volume in a bucket, the system can still keep the average lane speed. However, a zero-speed reading with zero volume is not counted as congestion. It may mean that no vehicle passed the sensor during the period.

The source road names include location descriptions. For example, one value may be `Waterloo Road near Kowloon Tong Club - Southbound`. We extract `Waterloo Road` as the road base. This avoids treating every `near` description as a separate road. The original road text remains in the database for audit.

### 5.2 Traffic aggregates

`traffic_detector_15m` is the main analytical traffic collection. It contains one row per detector and 15-minute bucket. Each row includes the weighted speed, volume, occupancy, lane count, observation count, district, road base, coordinates, and latest source time.

Low speed is defined as less than 20 km/h with positive volume. This is a transparent screening rule, not an official definition of congestion. The dashboard still needs to show sample size and data coverage beside this metric.

The `traffic_latest` collection keeps one recent state for each detector. It supports the live KPI cards and map. The `traffic_road_hourly` collection groups detector data by road, direction, and hour. It supports longer time trends without returning a large number of detector rows.

The analytical writes use deterministic `_id` values and MongoDB `$merge`. The same period can be processed again without creating duplicate records. This is useful when a flow restarts or historical records arrive late.

### 5.3 Rainfall processing

The rainfall feed contains one record per station and observation time. A normal automatic weather station record is numeric. `M` is stored as a missing value. `T` is stored as zero millimetres with a trace flag.

The system groups station records into 15-minute network summaries. It calculates the number of stations, the number of missing stations, the number of raining stations, the average rainfall, and the maximum station rainfall. The rain categories are no rain, light, moderate, and heavy.

### 5.4 Weather and traffic join

Traffic and weather are joined on the 15-minute time bucket. Each traffic bucket receives the matching weather summary when one exists.

Some traffic buckets have no matching weather record. These records keep `weatherMatched=false`, and their weather fields remain null. They are not treated as no-rain observations. This avoids mixing missing data with real dry weather.

The current draft snapshot has 657,811 traffic aggregate buckets. Of these, 656,267 are matched to a weather bucket. The match rate is about 99.8 percent.

### 5.5 Data retention

The system uses a rolling retention model. Raw traffic is large, so it is kept for eight days. This gives a full seven-day raw data window plus one day of buffer. Rainfall and collection run logs are kept for 30 days because they are much smaller and useful for weather analysis.

Table 5.1 summarises the retention policy.

| Data | Retention | Reason |
|---|---:|---|
| Raw traffic observations | 8 days | Keep one full week of raw detail |
| Raw rainfall observations | 30 days | Improve weather sample coverage |
| Collection run records | 30 days | Support monitoring and audit |
| Traffic and weather aggregates | Long term | Keep historical trends after raw traffic expires |

MongoDB TTL indexes apply the retention rules automatically. The aggregate collections remain available after older raw traffic is removed. For the assignment submission, the export script selects the most recent seven days of raw data and the full aggregate history.

This follows the course guidance for a real-time application. The collection does not grow without limit, but the dashboard still keeps the historical trends needed for analysis.

### 5.6 Draft data snapshot

The numbers in Table 5.2 come from the server on 19 November 2026. They are included to show the scale of the system. They are not the final submission figures.

| Collection | Draft count |
|---|---:|
| Raw traffic observations | 9,526,834 |
| Raw rainfall observations | 30,780 |
| Collection runs | 3,017 |
| 15-minute traffic aggregates | 657,811 |
| Latest detector states | 785 |
| Hourly road aggregates | 65,510 |
| Rainfall summaries | 855 |
| Weather-traffic aggregates | 657,811 |

At the time of this draft, the latest traffic record was about five minutes old. The latest weather observation was about 15 minutes old. The latest aggregate bucket was about 18 minutes old. These delays are within the expected collection and aggregation schedule.

The server had about 20 GB of free disk space. Raw traffic had reached its eight-day retention limit, so the database was no longer growing at the original daily rate.

### 5.7 Data quality and limitations

The traffic feed reports changing detector coverage. Some periods contain fewer active detectors than others. The dashboard therefore shows catalog coverage and sample counts. A missing detector is not treated as a slow detector.

The traffic feed also contains some unusual values. For example, a few rows are marked valid but have a speed above 200 km/h. The cleaning rule removes these values before analysis. Zero-volume records are kept for completeness, but they are not counted as low-speed congestion.

The weather feed has occasional missing station values. These are stored as missing, not zero. When a weather snapshot is not available, the traffic bucket is marked as unmatched.

The server restarted once during the collection period. The traffic data contains a gap of about 220 minutes around that restart. Later checks found both services healthy, and the logs did not show a memory exhaustion event. This incident is reported as a data limitation rather than removed from the record.

## Appendix A: Deployment and Reproduction

The project is stored at:

`https://github.com/Yixin-Joy/multimedia-group`

The basic deployment command is:

```bash
git clone https://github.com/Yixin-Joy/multimedia-group.git
cd multimedia-group
docker compose up -d --build
```

The first startup downloads the Docker images and restores the MongoDB seed. The seed is split into four files because the complete archive is larger than GitHub's single-file limit. The restore script combines the parts, checks the SHA-256 value, restores the collections, and then creates the indexes.

Node-RED is available at `http://localhost:1880`. The traffic dashboard is available at `http://localhost:1880/traffic`. MongoDB listens on `127.0.0.1:27017` and is not exposed to the public network.

The stack can be checked with:

```bash
docker compose ps
docker compose logs --tail 100 node-red
docker compose exec -T mongo mongosh smartcity --quiet < tools/verify_analytics.js
```

To stop the services without deleting data:

```bash
docker compose down
```

To restore the saved snapshot again, remove the data volumes and start the stack:

```bash
docker compose down -v
docker compose up -d --build
```

The second command deletes local database changes. It should only be used when a clean restore from the repository snapshot is required.

## Appendix B: Data Dictionary Summary

The full field list is in `DATA_DICTIONARY.md`. Table B.1 provides a short summary for the report.

| Collection | Purpose |
|---|---|
| `traffic_observations` | Raw lane-level speed, volume, and occupancy |
| `traffic_detector_catalog` | Detector, road, district, direction, and coordinates |
| `rainfall_observations` | Raw station-level rainfall values |
| `traffic_detector_15m` | Cleaned detector and 15-minute traffic aggregates |
| `traffic_latest` | Latest state for each detector |
| `traffic_road_hourly` | Road and direction hourly aggregates |
| `rainfall_15m` | Network rainfall summaries |
| `traffic_weather_15m` | Traffic aggregates joined to weather buckets |
| `ingestion_runs` | Collection status and duplicate handling records |

All source timestamps are stored as UTC dates. Dashboard labels are converted to Hong Kong time. This keeps storage consistent and avoids ambiguity when the application is opened from another time zone.

## Technical Points for the Discussion

The system can collect and store data continuously, but it is not a full model of Hong Kong traffic. It only covers roads with available Transport Department detectors. A low-speed detector may show a traffic problem, road geometry, a signal delay, or a sensor issue. The dashboard should present it as a location for review, not as proof of a road closure.

The weather comparison also needs careful wording. Rainfall and speed may move together in the data, but this does not prove that rain caused the change. Traffic volume, time of day, road type, incidents, and missing detector values can also affect the result.

The rolling retention policy is an important part of the design. It keeps the system manageable without deleting the aggregate evidence needed for the report. The final export will use a frozen seven-day raw dataset and the full aggregate history, so the tutor can restore and inspect the application.

