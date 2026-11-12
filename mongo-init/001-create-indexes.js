const smartcity = db.getSiblingDB("smartcity");

smartcity.traffic_observations.createIndex(
  { observedAt: 1, detectorId: 1, laneId: 1 },
  { name: "obs_detector_lane" },
);
smartcity.traffic_detector_catalog.createIndex(
  { district: 1, roadEn: 1 },
  { name: "district_road" },
);
smartcity.rainfall_observations.createIndex(
  { stationId: 1, obsTime: 1 },
  { name: "station_time" },
);

// Raw traffic detail is retained for eight days so the dashboard and final
// export always have a complete seven-day window plus one day of buffer.
smartcity.traffic_observations.createIndex(
  { observedAt: 1 },
  { name: "ttl_observedAt_8d", expireAfterSeconds: 8 * 24 * 60 * 60 },
);

// Rainfall is small and retained longer to improve weather-sample coverage.
smartcity.rainfall_observations.createIndex(
  { obsTime: 1 },
  { name: "ttl_obsTime_30d", expireAfterSeconds: 30 * 24 * 60 * 60 },
);

smartcity.ingestion_runs.createIndex(
  { runAt: 1 },
  { name: "ttl_runAt_30d", expireAfterSeconds: 30 * 24 * 60 * 60 },
);

smartcity.traffic_detector_15m.createIndex(
  { binStart: 1, district: 1 },
  { name: "time_district" },
);
smartcity.traffic_detector_15m.createIndex(
  { detectorId: 1, binStart: -1 },
  { name: "detector_time" },
);
smartcity.traffic_road_hourly.createIndex(
  { hourStart: -1, roadBase: 1 },
  { name: "hour_road" },
);
smartcity.traffic_latest.createIndex(
  { district: 1, lowSpeed: -1 },
  { name: "district_speed_state" },
);
smartcity.rainfall_15m.createIndex(
  { obsTime: -1 },
  { name: "obs_time" },
);
smartcity.traffic_weather_15m.createIndex(
  { binStart: 1, district: 1 },
  { name: "time_district" },
);
smartcity.traffic_weather_15m.createIndex(
  { rainCategory: 1, binStart: -1 },
  { name: "rain_time" },
);

