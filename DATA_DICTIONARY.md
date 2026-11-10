# Data Dictionary

This document defines the MongoDB collections included in the seed archive and written by the Node-RED flow.

All timestamps are stored as BSON `Date` values in UTC. Dashboard labels must be converted to `Asia/Hong_Kong` for display.

## Seed snapshot

| Property | Value |
|---|---|
| Snapshot time | 2026-11-10 17:18 HKT |
| Database | `smartcity` |
| Archive | `mongo-init/smartcity-seed.archive.gz` |
| Archive SHA-256 | `7B6EDE12D0D38BF46C9066F56D545C04ABDDEADCF85131E97DFB17829A19B95D` |
| Traffic observations | 314,804 |
| Weather observations | 936 |
| Detector catalog records | 807 |

## `traffic_observations`

One document represents one detector lane during one 30-second source interval.

| Field | Type | Unit | Description |
|---|---|---|---|
| `_id` | String | - | Deterministic key: `traffic:sourceDate:periodFrom:detectorId:laneId` |
| `source` | String | - | Source identifier; currently `TD rawSpeedVol-all.xml` |
| `sourceDate` | String | `YYYY-MM-DD` | Source date in Hong Kong time |
| `periodFrom` | String | `HH:mm:ss` | Start of the 30-second source interval |
| `periodTo` | String | `HH:mm:ss` | End of the 30-second source interval |
| `observedAt` | Date | UTC | Parsed source observation time |
| `fetchedAt` | Date | UTC | Time when the collector received the record |
| `detectorId` | String | - | Transport Department detector ID |
| `direction` | String | - | Reported travel direction |
| `laneId` | String | - | Lane name such as `Fast Lane` or `Slow Lane` |
| `speedKmh` | Number | km/h | Average lane speed |
| `occupancyPct` | Number or null | percent | Lane occupancy reported by the source |
| `volume` | Number or null | vehicles | Vehicle count for the source interval |
| `speedStdDev` | Number or null | km/h | Speed standard deviation reported as `s.d.` |
| `valid` | Boolean | - | `true` when the source reports `valid=Y` |

Recommended query filters before aggregation:

```javascript
{
  valid: true,
  speedKmh: { $gte: 0, $lte: 200 },
  occupancyPct: { $gte: 0, $lte: 100 }
}
```

The source occasionally reports zero speed with zero volume. Treat zero volume as an idle or unavailable lane, not automatically as congestion.

## `traffic_detector_catalog`

One document represents a transport detector and its road/geospatial metadata.

| Field | Type | Unit | Description |
|---|---|---|---|
| `_id` | String | - | Same value as `detectorId` |
| `detectorId` | String | - | Transport Department detector ID |
| `district` | String | - | District name |
| `roadEn` | String | - | English road/segment description |
| `roadTc` | String | - | Traditional Chinese road description |
| `roadSc` | String | - | Simplified Chinese road description |
| `easting` | Number or null | m | Hong Kong 1980 projected easting |
| `northing` | Number or null | m | Hong Kong 1980 projected northing |
| `latitude` | Number or null | degrees | WGS84 latitude |
| `longitude` | Number or null | degrees | WGS84 longitude |
| `direction` | String | - | Direction from the static catalog |
| `rotation` | Number or null | degrees | Map marker rotation supplied by the source |
| `source` | String | - | Source CSV identifier |
| `catalogFetchedAt` | Date | UTC | Time when the catalog was collected |

`roadEn` is a full location description such as `Waterloo Road near Kowloon Tong Club - Southbound`. For road-level dashboards, derive:

- `roadBase`: text before `near`
- `direction`: normalized text after the final `-`

## `rainfall_observations`

One document represents one automatic weather station at one official observation time.

| Field | Type | Unit | Description |
|---|---|---|---|
| `_id` | String | - | Deterministic key: `rainfall:obsTimeISO:stationId` |
| `source` | String | - | `HKO hourlyRainfall API` |
| `stationId` | String | - | HKO automatic weather station ID |
| `stationName` | String | - | HKO station name |
| `obsTime` | Date | UTC | Official rainfall observation time |
| `fetchedAt` | Date | UTC | Time when the collector received the record |
| `rainfallValueRaw` | String or Number | mm | Original HKO value |
| `rainfallMm` | Number or null | mm | Numeric rainfall; `null` when missing |
| `unit` | String | - | Source unit, normally `mm` |
| `qualityFlag` | String | - | `ok`, `trace`, or `missing` |
| `isRaining` | Boolean | - | `true` only when numeric rainfall is greater than zero |

Source value handling:

| Source value | `rainfallMm` | `qualityFlag` | `isRaining` |
|---|---:|---|---|
| Numeric value | Numeric value | `ok` | `value > 0` |
| `T` | 0 | `trace` | false |
| `M` | null | `missing` | false |

## Recommended derived collections

The raw collections remain unchanged. Data-cleaning and Dashboard flows should create these idempotent aggregates.

### `traffic_latest`

One document per detector with the latest usable observation and catalog fields. Use this collection for live KPI cards and the map.

### `traffic_detector_15m`

One document per detector and 15-minute time bucket.

| Field | Type | Description |
|---|---|---|
| `_id` | String | `traffic15:<binStartISO>:<detectorId>` |
| `binStart` | Date | Start of the 15-minute bucket |
| `detectorId` | String | Detector ID |
| `district` | String | District |
| `roadBase` | String | Normalized road name |
| `direction` | String | Normalized direction |
| `avgSpeedKmh` | Number | Volume-weighted lane speed |
| `totalVolume` | Number | Sum of valid lane volume |
| `avgOccupancyPct` | Number | Mean valid lane occupancy |
| `validLaneCount` | Number | Number of valid lane rows |
| `expectedLaneCount` | Number | Number of lanes expected for the detector |
| `completeness` | Number | `validLaneCount / expectedLaneCount` |
| `lowSpeed` | Boolean | Speed below the configured threshold and volume above zero |
| `latestObservedAt` | Date | Latest source observation in the bucket |

### `rainfall_15m`

One document per 15-minute weather bucket.

| Field | Type | Description |
|---|---|---|
| `_id` | String | `rainfall15:<obsTimeISO>` |
| `obsTime` | Date | Weather observation time |
| `stationCount` | Number | Number of expected stations |
| `missingStations` | Number | Stations with `qualityFlag=missing` |
| `rainingStations` | Number | Stations with positive rainfall |
| `networkAvgMm` | Number | Mean rainfall across valid stations |
| `networkMaxMm` | Number | Maximum valid station rainfall |
| `rainCategory` | String | `no-rain`, `light`, `moderate`, or `heavy` |

### `traffic_weather_15m`

One document per detector and 15-minute bucket after joining `traffic_detector_15m` with `rainfall_15m`.

Required fields:

- All `traffic_detector_15m` fields
- `networkAvgMm`
- `rainingStations`
- `rainCategory`
- `weatherMatched` boolean

Unmatched traffic buckets must not be assigned zero rainfall.

## Dashboard metric definitions

| Metric | Definition |
|---|---|
| Network Speed | Mean detector speed across the selected time window |
| Slow Segments | Valid detectors with speed below 20 km/h and volume above zero |
| Coverage | Detectors with a usable latest observation divided by the 807 catalog detectors |
| Data Freshness | Current time minus the latest usable `observedAt` or `obsTime` |
| Low-speed Share | Slow detector-time buckets divided by total valid detector-time buckets |
| Relative Slowdown | Speed below 50% of the detector's historical median speed |
| Rainy Period | 15-minute weather bucket with `networkAvgMm > 0` |

Low-speed share and weather comparisons must display their sample counts. Do not present correlations as causality.

