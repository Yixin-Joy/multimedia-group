const out = {
  counts: {
    traffic: db.traffic_observations.countDocuments(),
    rainfall: db.rainfall_observations.countDocuments(),
    ingestionRuns: db.ingestion_runs.countDocuments(),
    traffic15: db.traffic_detector_15m.countDocuments(),
    trafficLatest: db.traffic_latest.countDocuments(),
    roadHourly: db.traffic_road_hourly.countDocuments(),
    rainfall15: db.rainfall_15m.countDocuments(),
    weatherJoin: db.traffic_weather_15m.countDocuments(),
    weatherMatched: db.traffic_weather_15m.countDocuments({
      weatherMatched: true,
    }),
    lowSpeed: db.traffic_detector_15m.countDocuments({ lowSpeed: true }),
  },
  latestSample: db.traffic_latest.findOne(
    {},
    {},
    { sort: { latestObservedAt: -1 } },
  ),
  weatherCategories: db.traffic_weather_15m
    .aggregate([
      { $group: { _id: "$rainCategory", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray(),
  indexes: {
    traffic15: db.traffic_detector_15m.getIndexes().map((index) => index.name),
    trafficLatest: db.traffic_latest.getIndexes().map((index) => index.name),
    weatherJoin: db.traffic_weather_15m.getIndexes().map((index) => index.name),
    trafficTTL: db.traffic_observations
      .getIndexes()
      .filter((index) => index.expireAfterSeconds !== undefined)
      .map((index) => ({
        name: index.name,
        ttl: index.expireAfterSeconds,
      })),
    rainfallTTL: db.rainfall_observations
      .getIndexes()
      .filter((index) => index.expireAfterSeconds !== undefined)
      .map((index) => ({
        name: index.name,
        ttl: index.expireAfterSeconds,
      })),
    ingestionRunsTTL: db.ingestion_runs
      .getIndexes()
      .filter((index) => index.expireAfterSeconds !== undefined)
      .map((index) => ({
        name: index.name,
        ttl: index.expireAfterSeconds,
      })),
  },
};

print(JSON.stringify(out, null, 2));

