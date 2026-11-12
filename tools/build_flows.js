"use strict";

const fs = require("node:fs");
const path = require("node:path");

const trafficTab = "1100000000000001";
const parkingTab = "2200000000000001";
const analyticsTab = "3300000000000001";
const mongodbClient = "9000000000000001";

const functionNode = (id, tab, name, func, x, y, wires) => ({
  id,
  type: "function",
  z: tab,
  name,
  func,
  outputs: 1,
  timeout: "",
  noerr: 0,
  initialize: "",
  finalize: "",
  libs: [],
  x,
  y,
  wires: [wires],
});

const injectNode = (
  id,
  tab,
  name,
  repeat,
  x,
  y,
  wires,
  once = true,
  onceDelay = "1",
) => ({
  id,
  type: "inject",
  z: tab,
  name,
  props: [
    { p: "payload" },
    { p: "topic", vt: "str" },
  ],
  repeat,
  crontab: "",
  once,
  onceDelay: once ? onceDelay : "0",
  topic: "",
  payload: "",
  payloadType: "date",
  x,
  y,
  wires: [wires],
});

const httpNode = (id, tab, name, url, ret, x, y, wires) => ({
  id,
  type: "http request",
  z: tab,
  name,
  method: "GET",
  ret,
  paytoqs: "ignore",
  url,
  tls: "",
  persist: false,
  proxy: "",
  insecureHTTPParser: false,
  authType: "",
  senderr: true,
  headers: [],
  x,
  y,
  wires: [wires],
});

const mongoNode = (
  id,
  tab,
  name,
  collection,
  operation,
  x,
  y,
  wires,
) => ({
  id,
  type: "mongodb4",
  z: tab,
  clientNode: mongodbClient,
  mode: "collection",
  collection,
  operation,
  output: "toArray",
  maxTimeMS: "",
  handleDocId: false,
  name,
  x,
  y,
  wires: [wires],
});

const debugNode = (id, tab, name, x, y, complete = "payload") => ({
  id,
  type: "debug",
  z: tab,
  name,
  active: true,
  tosidebar: true,
  console: true,
  tostatus: false,
  complete,
  targetType: "msg",
  statusVal: "",
  statusType: "auto",
  x,
  y,
  wires: [],
});

const catchNode = (id, tab, name, x, y, wires, scope = null) => ({
  id,
  type: "catch",
  z: tab,
  name,
  scope,
  uncaught: false,
  x,
  y,
  wires: [wires],
});

const delayNode = (id, tab, name, x, y, wires) => ({
  id,
  type: "delay",
  z: tab,
  name,
  pauseType: "delay",
  timeout: "30",
  timeoutUnits: "seconds",
  rate: "1",
  nbRateUnits: "1",
  rateUnits: "second",
  randomFirst: "1",
  randomLast: "5",
  randomUnits: "seconds",
  drop: false,
  allowrate: false,
  outputs: 1,
  x,
  y,
  wires: [wires],
});

const trafficParse = `// Convert rawSpeedVol-all.xml into one row per detector lane and interval.
const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
const root = msg.payload && msg.payload.raw_speed_volume_list
  ? msg.payload.raw_speed_volume_list
  : msg.payload;

if (!root) {
  node.error("Traffic XML did not contain raw_speed_volume_list", msg);
  return null;
}

const first = (value) => Array.isArray(value) ? value[0] : value;
const children = (container, key) =>
  asArray(container).flatMap((item) => asArray(item && item[key]));
const text = (value) => String(first(value) ?? "").trim();

const sourceDate = text(root.date);
const periods = children(root.periods, "period");
const fetchedAt = new Date();
const operations = [];
let detectorIntervals = 0;
let invalidRows = 0;
const sourcePeriods = [];

for (const period of periods) {
  const periodFrom = text(period.period_from);
  const periodTo = text(period.period_to);
  if (periodFrom) sourcePeriods.push(periodFrom);
  const observedAt = periodFrom
    ? new Date(sourceDate + "T" + periodFrom + "+08:00")
    : fetchedAt;
  const detectors = children(period.detectors, "detector");

  for (const detector of detectors) {
    const detectorId = text(detector.detector_id);
    const direction = text(detector.direction);
    const lanes = children(detector.lanes, "lane");
    if (detectorId) detectorIntervals += 1;

    for (const lane of lanes) {
      const laneId = text(lane.lane_id);
      const speed = Number(first(lane.speed));
      if (!detectorId || !laneId || !Number.isFinite(speed)) {
        invalidRows += 1;
        continue;
      }

      const valid = text(lane.valid).toUpperCase() === "Y";
      const id = [
        "traffic",
        sourceDate,
        periodFrom,
        detectorId,
        laneId,
      ].join(":");

      operations.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $setOnInsert: {
              _id: id,
              source: "TD rawSpeedVol-all.xml",
              sourceDate,
              periodFrom,
              periodTo,
              observedAt,
              fetchedAt,
              detectorId,
              direction,
              laneId,
              speedKmh: speed,
              occupancyPct: Number.isFinite(Number(first(lane.occupancy)))
                ? Number(first(lane.occupancy))
                : null,
              volume: Number.isFinite(Number(first(lane.volume)))
                ? Number(first(lane.volume))
                : null,
              speedStdDev: Number.isFinite(Number(first(lane["s.d."])))
                ? Number(first(lane["s.d."]))
                : null,
              valid,
            },
          },
          upsert: true,
        },
      });
    }
  }
}

if (!operations.length) {
  node.error("Traffic XML produced no valid lane observations", msg);
  return null;
}

msg.mode = "collection";
msg.collection = "traffic_observations";
msg.operation = "bulkWrite";
msg.payload = [operations, { ordered: false }];
msg.meta = {
  sourceRows: operations.length,
  detectorIntervals,
  invalidRows,
  periods: periods.length,
  sourceDate,
  firstPeriod: sourcePeriods[0] || null,
  lastPeriod: sourcePeriods[sourcePeriods.length - 1] || null,
};
node.status({
  fill: "green",
  shape: "dot",
  text: operations.length + " rows / " + periods.length + " periods",
});
return msg;`;

const weatherParse = `// Normalize HKO hourly rainfall to one observation per station and hour.
let raw = msg.payload;
if (typeof raw === "string") {
  raw = JSON.parse(raw.replace(/^\\uFEFF/, ""));
}
if (!raw || !Array.isArray(raw.hourlyRainfall)) {
  node.error("HKO response did not contain hourlyRainfall", msg);
  return null;
}

const fetchedAt = new Date();
const obsTime = raw.obsTime ? new Date(raw.obsTime) : fetchedAt;
const operations = [];
let missing = 0;
let trace = 0;

for (const station of raw.hourlyRainfall) {
  const stationId = String(station.automaticWeatherStationID || "").trim();
  if (!stationId) continue;

  const rawValue = String(station.value ?? "").trim().toUpperCase();
  let rainfallMm = null;
  let qualityFlag = "ok";
  if (rawValue === "M") {
    missing += 1;
    qualityFlag = "missing";
  } else if (rawValue === "T") {
    trace += 1;
    rainfallMm = 0;
    qualityFlag = "trace";
  } else if (rawValue !== "" && Number.isFinite(Number(rawValue))) {
    rainfallMm = Number(rawValue);
  } else {
    missing += 1;
    qualityFlag = "missing";
  }

  const id = "rainfall:" + obsTime.toISOString() + ":" + stationId;
  operations.push({
    updateOne: {
      filter: { _id: id },
      update: {
        $setOnInsert: {
          _id: id,
          source: "HKO hourlyRainfall API",
          stationId,
          stationName: String(station.automaticWeatherStation || "").trim(),
          obsTime,
          fetchedAt,
          rainfallValueRaw: station.value,
          rainfallMm,
          unit: station.unit || "mm",
          qualityFlag,
          isRaining: rainfallMm != null && rainfallMm > 0,
        },
      },
      upsert: true,
    },
  });
}

if (!operations.length) {
  node.error("HKO response produced no station observations", msg);
  return null;
}

msg.mode = "collection";
msg.collection = "rainfall_observations";
msg.operation = "bulkWrite";
msg.payload = [operations, { ordered: false }];
msg.meta = {
  sourceRows: operations.length,
  missing,
  trace,
  obsTime: obsTime.toISOString(),
};
node.status({ fill: "green", shape: "dot", text: operations.length + " stations" });
return msg;`;

const parkingVacancyParse = `// Normalize TD vacancy_all.json into one row per park, vehicle type and service.
let raw = msg.payload;
if (typeof raw === "string") {
  raw = JSON.parse(raw.replace(/^\\uFEFF/, ""));
}
const parks = Array.isArray(raw) ? raw : (raw && raw.car_park);
if (!Array.isArray(parks)) {
  node.error("Parking vacancy response did not contain car_park", msg);
  return null;
}

const fetchedAt = new Date();
const operations = [];
let missing = 0;
let validRows = 0;

for (const park of parks) {
  const parkId = String(park.park_id || "").trim();
  if (!parkId) continue;

  for (const vehicle of (park.vehicle_type || [])) {
    for (const service of (vehicle.service_category || [])) {
      const lastUpdateText = String(service.lastupdate || "").trim();
      const lastUpdate = lastUpdateText
        ? new Date(lastUpdateText.replace(" ", "T") + "+08:00")
        : fetchedAt;
      const vacancyRaw = Number(service.vacancy);
      const valid = Number.isFinite(vacancyRaw) && vacancyRaw >= 0;
      if (!valid) missing += 1;
      if (valid) validRows += 1;

      const id = [
        "parking",
        parkId,
        vehicle.type,
        service.category,
        lastUpdateText || fetchedAt.toISOString(),
      ].join(":");

      operations.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $setOnInsert: {
              _id: id,
              source: "TD vacancy_all.json",
              parkId,
              vehicleType: String(vehicle.type || "").trim(),
              serviceCategory: String(service.category || "").trim(),
              vacancyType: String(service.vacancy_type || "").trim(),
              vacancyRaw: Number.isFinite(vacancyRaw) ? vacancyRaw : null,
              vacancy: valid ? vacancyRaw : null,
              valid,
              lastUpdate,
              fetchedAt,
            },
          },
          upsert: true,
        },
      });
    }
  }
}

if (!operations.length) {
  node.error("Parking response produced no vacancy rows", msg);
  return null;
}

msg.mode = "collection";
msg.collection = "parking_vacancy_observations";
msg.operation = "bulkWrite";
msg.payload = [operations, { ordered: false }];
msg.meta = { sourceRows: operations.length, validRows, missing };
node.status({
  fill: "green",
  shape: "dot",
  text: validRows + " valid / " + operations.length + " rows",
});
return msg;`;

const parkingCatalogParse = `// Store the static parking catalog keyed by park_id.
let raw = msg.payload;
if (typeof raw === "string") {
  raw = JSON.parse(raw.replace(/^\\uFEFF/, ""));
}
const parks = Array.isArray(raw) ? raw : (raw && raw.car_park);
if (!Array.isArray(parks)) {
  node.error("Parking catalog response did not contain car_park", msg);
  return null;
}

const fetchedAt = new Date();
const operations = parks
  .map((park) => {
    const parkId = String(park.park_id || "").trim();
    if (!parkId) return null;
    return {
      updateOne: {
        filter: { _id: parkId },
        update: {
          $set: {
            parkId,
            nameEn: park.name_en || "",
            nameTc: park.name_tc || "",
            nameSc: park.name_sc || "",
            addressEn: park.displayAddress_en || "",
            districtEn: park.district_en || "",
            districtTc: park.district_tc || "",
            districtSc: park.district_sc || "",
            latitude: Number.isFinite(Number(park.latitude))
              ? Number(park.latitude)
              : null,
            longitude: Number.isFinite(Number(park.longitude))
              ? Number(park.longitude)
              : null,
            openingStatus: park.opening_status || "",
            source: "TD basic_info_all.json",
            catalogFetchedAt: fetchedAt,
          },
        },
        upsert: true,
      },
    };
  })
  .filter(Boolean);

if (!operations.length) {
  node.error("Parking catalog produced no documents", msg);
  return null;
}

msg.mode = "collection";
msg.collection = "parking_catalog";
msg.operation = "bulkWrite";
msg.payload = [operations, { ordered: false }];
msg.meta = { sourceRows: operations.length };
node.status({ fill: "green", shape: "dot", text: operations.length + " parks" });
return msg;`;

const parkingCapacityParse = `// Store capacities from the One-Stop API. Real-time files do not publish totals.
let raw = msg.payload;
if (typeof raw === "string") {
  raw = JSON.parse(raw.replace(/^\\uFEFF/, ""));
}
const parks = Array.isArray(raw) ? raw : (raw && raw.results);
if (!Array.isArray(parks)) {
  node.error("One-Stop parking response did not contain results", msg);
  return null;
}

const fetchedAt = new Date();
const operations = [];

for (const park of parks) {
  const parkId = String(park.park_Id || park.park_id || "").trim();
  if (!parkId) continue;

  const vehicleCapacities = {};
  for (const key of ["privateCar", "LGV", "HGV", "coach", "motorCycle"]) {
    const value = park[key] && park[key].space;
    if (Number.isFinite(Number(value))) {
      vehicleCapacities[key] = Number(value);
    }
  }

  operations.push({
    updateOne: {
      filter: { _id: parkId },
      update: {
        $set: {
          parkId,
          name: park.name || "",
          district: park.district || "",
          vehicleCapacities,
          privateCarSpaces: vehicleCapacities.privateCar ?? null,
          source: "DATA.GOV.HK carpark-info-vacancy",
          capacityFetchedAt: fetchedAt,
        },
      },
      upsert: true,
    },
  });
}

if (!operations.length) {
  node.error("Capacity response produced no documents", msg);
  return null;
}

msg.mode = "collection";
msg.collection = "parking_capacity";
msg.operation = "bulkWrite";
msg.payload = [operations, { ordered: false }];
msg.meta = { sourceRows: operations.length };
node.status({ fill: "green", shape: "dot", text: operations.length + " capacities" });
return msg;`;

const trafficCatalogParse = `// Parse the TD detector location CSV and key each row by AID_ID_Number.
function parseCsv(text) {
  const source = String(text || "").replace(/^\\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((ch === "\\n" || ch === "\\r") && !quoted) {
      if (ch === "\\r" && source[i + 1] === "\\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];

  const headers = rows.shift().map((value) => value.trim());
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

const records = parseCsv(msg.payload);
if (!records.length) {
  node.error("Traffic detector catalog CSV produced no records", msg);
  return null;
}

const fetchedAt = new Date();
const operations = records
  .map((record) => {
    const detectorId = String(record.AID_ID_Number || "").trim();
    if (!detectorId) return null;
    return {
      updateOne: {
        filter: { _id: detectorId },
        update: {
          $set: {
            detectorId,
            district: record.District || "",
            roadEn: record.Road_EN || "",
            roadTc: record.Road_TC || "",
            roadSc: record.Road_SC || "",
            easting: Number(record.Easting) || null,
            northing: Number(record.Northing) || null,
            latitude: Number.isFinite(Number(record.Latitude))
              ? Number(record.Latitude)
              : null,
            longitude: Number.isFinite(Number(record.Longitude))
              ? Number(record.Longitude)
              : null,
            direction: record.Direction || "",
            rotation: Number(record.Rotation) || null,
            source: "TD traffic_speed_volume_occ_info.csv",
            catalogFetchedAt: fetchedAt,
          },
        },
        upsert: true,
      },
    };
  })
  .filter(Boolean);

if (!operations.length) {
  node.error("Traffic detector catalog produced no documents", msg);
  return null;
}

msg.mode = "collection";
msg.collection = "traffic_detector_catalog";
msg.operation = "bulkWrite";
msg.payload = [operations, { ordered: false }];
msg.meta = { sourceRows: operations.length };
node.status({ fill: "green", shape: "dot", text: operations.length + " detectors" });
return msg;`;

const trafficRunRecord = `// Persist a compact success record for each traffic poll.
const write = msg.payload || {};
const meta = msg.meta || {};
const runAt = new Date();
const runId = "trafficRun:" + runAt.toISOString();
const document = {
  _id: runId,
  source: "traffic",
  runAt,
  sourceDate: meta.sourceDate || null,
  firstPeriod: meta.firstPeriod || null,
  lastPeriod: meta.lastPeriod || null,
  periods: meta.periods || 0,
  detectorIntervals: meta.detectorIntervals || 0,
  attemptedRows: meta.sourceRows || 0,
  invalidRows: meta.invalidRows || 0,
  insertedRows: write.upsertedCount || 0,
  duplicateRows: write.matchedCount || 0,
  modifiedRows: write.modifiedCount || 0,
  status: "success",
};

msg.mode = "collection";
msg.collection = "ingestion_runs";
msg.operation = "updateOne";
msg.payload = [{ _id: runId }, { $setOnInsert: document }, { upsert: true }];
return msg;`;

const weatherRunRecord = `// Persist a compact success record for each weather poll.
const write = msg.payload || {};
const meta = msg.meta || {};
const runAt = new Date();
const runId = "rainfallRun:" + runAt.toISOString();
const document = {
  _id: runId,
  source: "rainfall",
  runAt,
  obsTime: meta.obsTime ? new Date(meta.obsTime) : null,
  attemptedRows: meta.sourceRows || 0,
  missingRows: meta.missing || 0,
  traceRows: meta.trace || 0,
  insertedRows: write.upsertedCount || 0,
  duplicateRows: write.matchedCount || 0,
  status: "success",
};

msg.mode = "collection";
msg.collection = "ingestion_runs";
msg.operation = "updateOne";
msg.payload = [{ _id: runId }, { $setOnInsert: document }, { upsert: true }];
return msg;`;

const trafficAggregateBuild = `// Build detector-level 15-minute traffic aggregates.
const hours = Math.max(1, Number(msg.lookbackHours || msg.payload || 6));
const since = new Date(Date.now() - hours * 60 * 60 * 1000);
msg.lookbackHours = hours;
msg.since = since;

const pipeline = [
  {
    $match: {
      valid: true,
      speedKmh: { $gte: 0, $lte: 200 },
      occupancyPct: { $gte: 0, $lte: 100 },
      observedAt: { $gte: since },
    },
  },
  {
    $set: {
      binStart: {
        $dateTrunc: { date: "$observedAt", unit: "minute", binSize: 15 },
      },
    },
  },
  {
    $group: {
      _id: { detectorId: "$detectorId", binStart: "$binStart" },
      direction: { $max: "$direction" },
      totalVolume: {
        $sum: {
          $cond: [
            { $and: [{ $ne: ["$volume", null] }, { $gte: ["$volume", 0] }] },
            "$volume",
            0,
          ],
        },
      },
      weightedSpeedSum: {
        $sum: {
          $cond: [
            { $and: [{ $gt: ["$volume", 0] }, { $ne: ["$speedKmh", null] }] },
            { $multiply: ["$speedKmh", "$volume"] },
            0,
          ],
        },
      },
      meanSpeedKmh: { $avg: "$speedKmh" },
      avgOccupancyPct: { $avg: "$occupancyPct" },
      laneIds: { $addToSet: "$laneId" },
      observationCount: { $sum: 1 },
      latestObservedAt: { $max: "$observedAt" },
    },
  },
  {
    $set: {
      avgSpeedKmh: {
        $cond: [
          { $gt: ["$totalVolume", 0] },
          { $divide: ["$weightedSpeedSum", "$totalVolume"] },
          "$meanSpeedKmh",
        ],
      },
      laneCount: { $size: "$laneIds" },
    },
  },
  {
    $lookup: {
      from: "traffic_detector_catalog",
      localField: "_id.detectorId",
      foreignField: "detectorId",
      as: "catalog",
    },
  },
  { $unwind: { path: "$catalog", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      detectorId: "$_id.detectorId",
      binStart: "$_id.binStart",
      direction: { $ifNull: ["$direction", ""] },
      district: { $ifNull: ["$catalog.district", "Unknown"] },
      roadEn: { $ifNull: ["$catalog.roadEn", ""] },
      roadBase: {
        $trim: {
          input: {
            $arrayElemAt: [
              { $split: [{ $ifNull: ["$catalog.roadEn", ""] }, " near "] },
              0,
            ],
          },
        },
      },
      latitude: { $ifNull: ["$catalog.latitude", null] },
      longitude: { $ifNull: ["$catalog.longitude", null] },
      avgSpeedKmh: { $round: ["$avgSpeedKmh", 2] },
      totalVolume: 1,
      avgOccupancyPct: { $round: ["$avgOccupancyPct", 2] },
      laneCount: 1,
      laneIds: 1,
      observationCount: 1,
      latestObservedAt: 1,
    },
  },
  {
    $set: {
      lowSpeed: { $and: [{ $lt: ["$avgSpeedKmh", 20] }, { $gt: ["$totalVolume", 0] }] },
      speedBand: {
        $switch: {
          branches: [
            { case: { $lt: ["$avgSpeedKmh", 20] }, then: "severe" },
            { case: { $lt: ["$avgSpeedKmh", 40] }, then: "slow" },
            { case: { $lt: ["$avgSpeedKmh", 60] }, then: "moderate" },
          ],
          default: "smooth",
        },
      },
      _id: {
        $concat: [
          "traffic15:",
          {
            $dateToString: {
              date: "$binStart",
              format: "%Y-%m-%dT%H:%M:%SZ",
              timezone: "UTC",
            },
          },
          ":",
          "$detectorId",
        ],
      },
    },
  },
  {
    $merge: {
      into: "traffic_detector_15m",
      on: "_id",
      whenMatched: "replace",
      whenNotMatched: "insert",
    },
  },
];

msg.mode = "collection";
msg.collection = "traffic_observations";
msg.operation = "aggregate";
msg.payload = [pipeline, { allowDiskUse: true }];
node.status({ fill: "blue", shape: "dot", text: "aggregate " + hours + "h" });
return msg;`;

const trafficRoadBuild = `// Build hourly road aggregates from detector 15-minute data.
const hours = Math.max(1, Number(msg.lookbackHours || 6));
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

const pipeline = [
  { $match: { binStart: { $gte: since }, roadBase: { $ne: "" } } },
  {
    $set: {
      hourStart: {
        $dateTrunc: { date: "$binStart", unit: "hour" },
      },
    },
  },
  {
    $group: {
      _id: {
        hourStart: "$hourStart",
        roadBase: "$roadBase",
        direction: "$direction",
      },
      totalVolume: { $sum: "$totalVolume" },
      weightedSpeedSum: {
        $sum: { $multiply: ["$avgSpeedKmh", "$totalVolume"] },
      },
      meanSpeedKmh: { $avg: "$avgSpeedKmh" },
      detectors: { $addToSet: "$detectorId" },
      lowSpeedBuckets: { $sum: { $cond: ["$lowSpeed", 1, 0] } },
      binCount: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      hourStart: "$_id.hourStart",
      roadBase: "$_id.roadBase",
      direction: "$_id.direction",
      totalVolume: 1,
      detectorCount: { $size: "$detectors" },
      detectorIds: "$detectors",
      lowSpeedBuckets: 1,
      binCount: 1,
      avgSpeedKmh: {
        $round: [
          {
            $cond: [
              { $gt: ["$totalVolume", 0] },
              { $divide: ["$weightedSpeedSum", "$totalVolume"] },
              "$meanSpeedKmh",
            ],
          },
          2,
        ],
      },
    },
  },
  {
    $set: {
      _id: {
        $concat: [
          "roadHour:",
          {
            $dateToString: {
              date: "$hourStart",
              format: "%Y-%m-%dT%H:00:00Z",
              timezone: "UTC",
            },
          },
          ":",
          "$roadBase",
          ":",
          "$direction",
        ],
      },
    },
  },
  {
    $merge: {
      into: "traffic_road_hourly",
      on: "_id",
      whenMatched: "replace",
      whenNotMatched: "insert",
    },
  },
];

msg.mode = "collection";
msg.collection = "traffic_detector_15m";
msg.operation = "aggregate";
msg.payload = [pipeline, { allowDiskUse: true }];
return msg;`;

const trafficLatestBuild = `// Promote the latest 15-minute detector bucket into a compact lookup collection.
const hours = Math.max(1, Number(msg.lookbackHours || 6));
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

const pipeline = [
  { $match: { binStart: { $gte: since } } },
  { $sort: { detectorId: 1, binStart: -1 } },
  {
    $group: {
      _id: "$detectorId",
      latest: { $first: "$$ROOT" },
    },
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: [
          "$latest",
          { _id: "$_id", promotedAt: "$$NOW" },
        ],
      },
    },
  },
  {
    $merge: {
      into: "traffic_latest",
      on: "_id",
      whenMatched: "replace",
      whenNotMatched: "insert",
    },
  },
];

msg.mode = "collection";
msg.collection = "traffic_detector_15m";
msg.operation = "aggregate";
msg.payload = [pipeline, { allowDiskUse: true }];
return msg;`;

const rainfallAggregateBuild = `// Build one network rainfall summary per 15-minute observation time.
const hours = Math.max(1, Number(msg.lookbackHours || 6));
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

const pipeline = [
  { $match: { obsTime: { $gte: since } } },
  {
    $group: {
      _id: "$obsTime",
      stationCount: { $sum: 1 },
      missingStations: {
        $sum: { $cond: [{ $eq: ["$qualityFlag", "missing"] }, 1, 0] },
      },
      rainingStations: {
        $sum: { $cond: ["$isRaining", 1, 0] },
      },
      validStations: {
        $sum: { $cond: [{ $ne: ["$rainfallMm", null] }, 1, 0] },
      },
      networkAvgMm: { $avg: "$rainfallMm" },
      networkMaxMm: { $max: "$rainfallMm" },
    },
  },
  { $set: { obsTime: "$_id" } },
  {
    $set: {
      networkAvgMm: { $round: ["$networkAvgMm", 3] },
      networkMaxMm: { $round: ["$networkMaxMm", 3] },
      rainCategory: {
        $switch: {
          branches: [
            { case: { $eq: ["$networkAvgMm", null] }, then: "unknown" },
            { case: { $lte: ["$networkAvgMm", 0] }, then: "no-rain" },
            { case: { $lt: ["$networkAvgMm", 1] }, then: "light" },
            { case: { $lt: ["$networkAvgMm", 5] }, then: "moderate" },
          ],
          default: "heavy",
        },
      },
      _id: {
        $concat: [
          "rainfall15:",
          {
            $dateToString: {
              date: "$obsTime",
              format: "%Y-%m-%dT%H:%M:%SZ",
              timezone: "UTC",
            },
          },
        ],
      },
    },
  },
  {
    $merge: {
      into: "rainfall_15m",
      on: "_id",
      whenMatched: "replace",
      whenNotMatched: "insert",
    },
  },
];

msg.mode = "collection";
msg.collection = "rainfall_observations";
msg.operation = "aggregate";
msg.payload = [pipeline, { allowDiskUse: true }];
return msg;`;

const weatherJoinBuild = `// Join detector 15-minute traffic with the matching weather bucket.
const hours = Math.max(1, Number(msg.lookbackHours || 6));
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

const pipeline = [
  { $match: { binStart: { $gte: since } } },
  {
    $lookup: {
      from: "rainfall_15m",
      localField: "binStart",
      foreignField: "obsTime",
      as: "weather",
    },
  },
  {
    $set: {
      weatherMatched: { $gt: [{ $size: "$weather" }, 0] },
    },
  },
  {
    $set: {
      networkAvgMm: {
        $ifNull: [{ $arrayElemAt: ["$weather.networkAvgMm", 0] }, null],
      },
      networkMaxMm: {
        $ifNull: [{ $arrayElemAt: ["$weather.networkMaxMm", 0] }, null],
      },
      rainingStations: {
        $ifNull: [{ $arrayElemAt: ["$weather.rainingStations", 0] }, null],
      },
      missingStations: {
        $ifNull: [{ $arrayElemAt: ["$weather.missingStations", 0] }, null],
      },
      rainCategory: {
        $ifNull: [{ $arrayElemAt: ["$weather.rainCategory", 0] }, "unmatched"],
      },
    },
  },
  { $unset: "weather" },
  {
    $merge: {
      into: "traffic_weather_15m",
      on: "_id",
      whenMatched: "replace",
      whenNotMatched: "insert",
    },
  },
];

msg.mode = "collection";
msg.collection = "traffic_detector_15m";
msg.operation = "aggregate";
msg.payload = [pipeline, { allowDiskUse: true }];
return msg;`;

const nodes = [
  {
    id: trafficTab,
    type: "tab",
    label: "Weather + Traffic",
    disabled: false,
    info:
      "Collects TD detector speed/volume/occupancy every 5 minutes and HKO hourly rainfall every 10 minutes.",
    env: [],
  },
  {
    id: analyticsTab,
    type: "tab",
    label: "Cleaning and Analytics",
    disabled: false,
    info:
      "Builds retention-safe 15-minute detector aggregates, hourly road aggregates, network rainfall summaries, and weather-traffic joins.",
    env: [],
  },
  {
    id: parkingTab,
    type: "tab",
    label: "Topic 2 - Smart parking supply and demand",
    disabled: true,
    info:
      "Disabled on 2026-11-10. The project now focuses on weather and traffic.",
    env: [],
  },
  injectNode(
    "1100000000000002",
    trafficTab,
    "Every 5 minutes",
    "300",
    150,
    120,
    ["1100000000000003"],
    true,
    "1",
  ),
  httpNode(
    "1100000000000003",
    trafficTab,
    "TD raw speed XML",
    "https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol-all.xml",
    "txt",
    360,
    120,
    ["1100000000000004"],
  ),
  {
    id: "1100000000000004",
    type: "xml",
    z: trafficTab,
    name: "Parse traffic XML",
    prop: "payload",
    attr: "",
    out: "js",
    x: 580,
     y: 120,
    wires: [["1100000000000005"]],
  },
  functionNode(
    "1100000000000005",
    trafficTab,
    "Normalize lane rows",
    trafficParse,
    800,
    120,
    ["1100000000000006"],
  ),
  mongoNode(
    "1100000000000006",
    trafficTab,
    "Upsert traffic",
    "traffic_observations",
    "bulkWrite",
    1030,
    120,
    ["1100000000000007", "1100000000000101"],
  ),
  debugNode(
    "1100000000000007",
    trafficTab,
    "Traffic write result",
    1240,
    120,
    "payload.upsertedCount",
  ),
  injectNode(
    "1100000000000008",
    trafficTab,
    "Every 10 minutes",
    "600",
    150,
    260,
    ["1100000000000009"],
    true,
    "5",
  ),
  httpNode(
    "1100000000000009",
    trafficTab,
    "HKO hourly rainfall",
    "https://data.weather.gov.hk/weatherAPI/opendata/hourlyRainfall.php?lang=en",
    "obj",
    390,
    260,
    ["1100000000000010"],
  ),
  functionNode(
    "1100000000000010",
    trafficTab,
    "Normalize rainfall",
    weatherParse,
    610,
    260,
    ["1100000000000011"],
  ),
  mongoNode(
    "1100000000000011",
    trafficTab,
    "Upsert rainfall",
    "rainfall_observations",
    "bulkWrite",
    830,
    260,
    ["1100000000000012", "1100000000000103"],
  ),
  debugNode(
    "1100000000000012",
    trafficTab,
    "Weather write result",
    1040,
    260,
    "payload.upsertedCount",
  ),
  injectNode(
    "1100000000000013",
    trafficTab,
    "Catalog every hour",
    "3600",
    150,
    400,
    ["1100000000000014"],
    true,
    "10",
  ),
  httpNode(
    "1100000000000014",
    trafficTab,
    "TD detector location CSV",
    "https://static.data.gov.hk/td/traffic-data-strategic-major-roads/info/traffic_speed_volume_occ_info.csv",
    "txt",
    390,
    400,
    ["1100000000000015"],
  ),
  functionNode(
    "1100000000000015",
    trafficTab,
    "Parse detector catalog",
    trafficCatalogParse,
    620,
    400,
    ["1100000000000016"],
  ),
  mongoNode(
    "1100000000000016",
    trafficTab,
    "Upsert detector catalog",
    "traffic_detector_catalog",
    "bulkWrite",
    850,
    400,
    ["1100000000000017"],
  ),
  debugNode(
    "1100000000000017",
    trafficTab,
    "Traffic catalog result",
    1080,
    400,
    "payload.upsertedCount",
  ),
  catchNode(
    "1100000000000018",
    trafficTab,
    "Topic 1 errors",
    390,
    540,
    ["1100000000000019"],
  ),
  debugNode(
    "1100000000000019",
    trafficTab,
    "Traffic / weather error",
    620,
    540,
    "error.message",
  ),
  catchNode(
    "1100000000000020",
    trafficTab,
    "Retry traffic after 30 seconds",
    140,
    620,
    ["1100000000000021"],
    ["1100000000000003"],
  ),
  delayNode(
    "1100000000000021",
    trafficTab,
    "Traffic retry delay",
    360,
    620,
    ["1100000000000003"],
  ),
  catchNode(
    "1100000000000022",
    trafficTab,
    "Retry weather after 30 seconds",
    140,
    680,
    ["1100000000000023"],
    ["1100000000000009"],
  ),
  delayNode(
    "1100000000000023",
    trafficTab,
    "Weather retry delay",
    360,
    680,
    ["1100000000000009"],
  ),
  catchNode(
    "1100000000000024",
    trafficTab,
    "Retry traffic catalog after 30 seconds",
    140,
    740,
    ["1100000000000025"],
    ["1100000000000014"],
  ),
  delayNode(
    "1100000000000025",
    trafficTab,
    "Traffic catalog retry delay",
    360,
    740,
    ["1100000000000014"],
  ),
  functionNode(
    "1100000000000101",
    trafficTab,
    "Record traffic run",
    trafficRunRecord,
    1240,
    180,
    ["1100000000000102"],
  ),
  mongoNode(
    "1100000000000102",
    trafficTab,
    "Save traffic run",
    "ingestion_runs",
    "updateOne",
    1450,
    180,
    ["1100000000000104"],
  ),
  debugNode(
    "1100000000000104",
    trafficTab,
    "Traffic run saved",
    1660,
    180,
    "payload.acknowledged",
  ),
  functionNode(
    "1100000000000103",
    trafficTab,
    "Record weather run",
    weatherRunRecord,
    1040,
    320,
    ["1100000000000105"],
  ),
  mongoNode(
    "1100000000000105",
    trafficTab,
    "Save weather run",
    "ingestion_runs",
    "updateOne",
    1250,
    320,
    ["1100000000000106"],
  ),
  debugNode(
    "1100000000000106",
    trafficTab,
    "Weather run saved",
    1460,
    320,
    "payload.acknowledged",
  ),

  {
    id: "3300000000000002",
    type: "inject",
    z: analyticsTab,
    name: "Backfill last 20 days once",
    props: [{ p: "payload", v: "480", vt: "num" }],
    repeat: "",
    crontab: "",
    once: true,
    onceDelay: "120",
    topic: "lookbackHours",
    payload: "480",
    payloadType: "num",
    x: 180,
    y: 160,
    wires: [["3300000000000004"]],
  },
  {
    id: "3300000000000003",
    type: "inject",
    z: analyticsTab,
    name: "Update last 6 hours",
    props: [{ p: "payload", v: "6", vt: "num" }],
    repeat: "900",
    crontab: "",
    once: true,
    onceDelay: "180",
    topic: "lookbackHours",
    payload: "6",
    payloadType: "num",
    x: 160,
    y: 260,
    wires: [["3300000000000004"]],
  },
  functionNode(
    "3300000000000004",
    analyticsTab,
    "Build traffic 15-minute aggregate",
    trafficAggregateBuild,
    430,
    200,
    ["3300000000000005"],
  ),
  {
    id: "3300000000000005",
    type: "mongodb4",
    z: analyticsTab,
    clientNode: mongodbClient,
    mode: "collection",
    collection: "traffic_observations",
    operation: "aggregate",
    output: "toArray",
    maxTimeMS: "",
    handleDocId: false,
    name: "Merge traffic_detector_15m",
    x: 720,
     y: 200,
    wires: [["3300000000000006"]],
  },
  functionNode(
    "3300000000000006",
    analyticsTab,
    "Build hourly road aggregate",
    trafficRoadBuild,
    430,
    320,
    ["3300000000000007"],
  ),
  {
    id: "3300000000000007",
    type: "mongodb4",
    z: analyticsTab,
    clientNode: mongodbClient,
    mode: "collection",
    collection: "traffic_detector_15m",
    operation: "aggregate",
    output: "toArray",
    maxTimeMS: "",
    handleDocId: false,
    name: "Merge traffic_road_hourly",
    x: 700,
     y: 320,
    wires: [["3300000000000020"]],
  },
  functionNode(
    "3300000000000020",
    analyticsTab,
    "Build latest detector state",
    trafficLatestBuild,
    430,
    380,
    ["3300000000000021"],
  ),
  {
    id: "3300000000000021",
    type: "mongodb4",
    z: analyticsTab,
    clientNode: mongodbClient,
    mode: "collection",
    collection: "traffic_detector_15m",
    operation: "aggregate",
    output: "toArray",
    maxTimeMS: "",
    handleDocId: false,
    name: "Merge traffic_latest",
    x: 700,
     y: 380,
    wires: [["3300000000000008"]],
  },
  functionNode(
    "3300000000000008",
    analyticsTab,
    "Build rainfall summary",
    rainfallAggregateBuild,
    430,
    440,
    ["3300000000000009"],
  ),
  {
    id: "3300000000000009",
    type: "mongodb4",
    z: analyticsTab,
    clientNode: mongodbClient,
    mode: "collection",
    collection: "rainfall_observations",
    operation: "aggregate",
    output: "toArray",
    maxTimeMS: "",
    handleDocId: false,
    name: "Merge rainfall_15m",
    x: 680,
     y: 440,
    wires: [["3300000000000010"]],
  },
  functionNode(
    "3300000000000010",
    analyticsTab,
    "Build weather join",
    weatherJoinBuild,
    430,
    560,
    ["3300000000000011"],
  ),
  {
    id: "3300000000000011",
    type: "mongodb4",
    z: analyticsTab,
    clientNode: mongodbClient,
    mode: "collection",
    collection: "traffic_detector_15m",
    operation: "aggregate",
    output: "toArray",
    maxTimeMS: "",
    handleDocId: false,
    name: "Merge traffic_weather_15m",
    x: 680,
     y: 560,
    wires: [["3300000000000012"]],
  },
  debugNode(
    "3300000000000012",
    analyticsTab,
    "Analytics aggregate result",
    940,
    560,
    "payload.length",
  ),
  catchNode(
    "3300000000000013",
    analyticsTab,
    "Analytics errors",
    430,
    700,
    ["3300000000000014"],
  ),
  debugNode(
    "3300000000000014",
    analyticsTab,
    "Analytics error",
    680,
    700,
    "error.message",
  ),

  injectNode(
    "2200000000000002",
    parkingTab,
    "Every 5 minutes",
    "310",
    150,
    120,
    ["2200000000000003"],
    true,
    "16",
  ),
  httpNode(
    "2200000000000003",
    parkingTab,
    "TD live vacancy JSON",
    "https://resource.data.one.gov.hk/td/carpark/vacancy_all.json",
    "txt",
    370,
    120,
    ["2200000000000004"],
  ),
  functionNode(
    "2200000000000004",
    parkingTab,
    "Normalize vacancy rows",
    parkingVacancyParse,
    600,
    120,
    ["2200000000000005"],
  ),
  mongoNode(
    "2200000000000005",
    parkingTab,
    "Upsert vacancy",
    "parking_vacancy_observations",
    "bulkWrite",
    830,
    120,
    ["2200000000000006"],
  ),
  debugNode(
    "2200000000000006",
    parkingTab,
    "Vacancy write result",
    1040,
    120,
    "payload.upsertedCount",
  ),
  injectNode(
    "2200000000000007",
    parkingTab,
    "Catalog every hour",
    "3720",
    150,
    260,
    ["2200000000000008"],
    true,
    "22",
  ),
  httpNode(
    "2200000000000008",
    parkingTab,
    "TD parking catalog JSON",
    "https://resource.data.one.gov.hk/td/carpark/basic_info_all.json",
    "txt",
    390,
    260,
    ["2200000000000009"],
  ),
  functionNode(
    "2200000000000009",
    parkingTab,
    "Normalize parking catalog",
    parkingCatalogParse,
    620,
    260,
    ["2200000000000010"],
  ),
  mongoNode(
    "2200000000000010",
    parkingTab,
    "Upsert parking catalog",
    "parking_catalog",
    "bulkWrite",
    850,
    260,
    ["2200000000000011"],
  ),
  debugNode(
    "2200000000000011",
    parkingTab,
    "Parking catalog result",
    1070,
    260,
    "payload.upsertedCount",
  ),
  injectNode(
    "2200000000000012",
    parkingTab,
    "Capacity every hour",
    "3780",
    150,
    400,
    ["2200000000000013"],
    true,
    "28",
  ),
  httpNode(
    "2200000000000013",
    parkingTab,
    "One-Stop parking capacity",
    "https://api.data.gov.hk/v1/carpark-info-vacancy",
    "obj",
    400,
    400,
    ["2200000000000014"],
  ),
  functionNode(
    "2200000000000014",
    parkingTab,
    "Normalize capacities",
    parkingCapacityParse,
    640,
    400,
    ["2200000000000015"],
  ),
  mongoNode(
    "2200000000000015",
    parkingTab,
    "Upsert capacity",
    "parking_capacity",
    "bulkWrite",
    850,
    400,
    ["2200000000000016"],
  ),
  debugNode(
    "2200000000000016",
    parkingTab,
    "Capacity write result",
    1060,
    400,
    "payload.upsertedCount",
  ),
  catchNode(
    "2200000000000017",
    parkingTab,
    "Topic 2 errors",
    390,
    540,
    ["2200000000000018"],
  ),
  debugNode(
    "2200000000000018",
    parkingTab,
    "Parking error",
    620,
    540,
    "error.message",
  ),
  catchNode(
    "2200000000000019",
    parkingTab,
    "Retry vacancy after 30 seconds",
    140,
    620,
    ["2200000000000020"],
    ["2200000000000003"],
  ),
  delayNode(
    "2200000000000020",
    parkingTab,
    "Vacancy retry delay",
    360,
    620,
    ["2200000000000003"],
  ),
  catchNode(
    "2200000000000021",
    parkingTab,
    "Retry parking catalog after 30 seconds",
    140,
    680,
    ["2200000000000022"],
    ["2200000000000008"],
  ),
  delayNode(
    "2200000000000022",
    parkingTab,
    "Parking catalog retry delay",
    360,
    680,
    ["2200000000000008"],
  ),
  catchNode(
    "2200000000000023",
    parkingTab,
    "Retry capacity after 30 seconds",
    140,
    740,
    ["2200000000000024"],
    ["2200000000000013"],
  ),
  delayNode(
    "2200000000000024",
    parkingTab,
    "Capacity retry delay",
    360,
    740,
    ["2200000000000013"],
  ),

  {
    id: mongodbClient,
    type: "mongodb4-client",
    name: "Local smartcity MongoDB",
    protocol: "mongodb",
    hostname: "mongo",
    port: "27017",
    dbName: "smartcity",
    appName: "smartcity-collector",
    authSource: "",
    authMechanism: "",
    tls: false,
    tlsCAFile: "",
    tlsCertificateKeyFile: "",
    tlsInsecure: false,
    connectTimeoutMS: "",
    socketTimeoutMS: "",
    minPoolSize: "",
    maxPoolSize: "",
    maxIdleTimeMS: "",
    uri: "",
    advanced: "{\"connectTimeoutMS\": 30000, \"serverSelectionTimeoutMS\": 30000}",
    uriTabActive: "tab-uri-simple",
  },
  {
    id: "9900000000000001",
    type: "global-config",
    env: [],
    modules: {
      "node-red-contrib-mongodb4": "3.4.0",
    },
  },
].filter((node) => node.id !== parkingTab && node.z !== parkingTab);

const outputDirectory = path.join(__dirname, "..", "node-red-data");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, "flows.json"),
  JSON.stringify(nodes, null, 2) + "\n",
  "utf8",
);

console.log(`Wrote ${nodes.length} Node-RED nodes to node-red-data/flows.json`);

