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

