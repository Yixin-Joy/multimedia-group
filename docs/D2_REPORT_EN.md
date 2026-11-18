# D2 — Traffic use case, methodology and results

Evidence generated: 2026-11-17T06:01:55.287Z. Source repository baseline: 94b9380816a09b4820367b346683dfa0065333ff. This is the traffic contribution, not the complete three-person report. The work plan gives inconsistent 8.1/8.2 numbering; the editor should place Traffic Recommendations by heading, then renumber.

## 1.2 Traffic use case and objectives

The traffic module supports a progression from overview to location and temporal diagnosis. It asks: which monitored locations are slow, when is low speed more common, and does an apparent long episode require traffic investigation or sensor-quality review? The intended user is an analyst inspecting monitored Hong Kong roads, not a driver receiving a guaranteed real-time route recommendation.

## 6. Traffic data analytics methodology

The dashboard queries traffic_detector_15m and the detector catalog. Current and historical states are derived from the same bounded aggregate history so that historical maps cannot accidentally show today's observations. The original collection and cleaning flows remain intact. Node-RED serves the interface and read-only MongoDB queries; no additional dashboard palette is required. Leaflet 1.9.4 is bundled locally, while OpenStreetMap background tiles require internet access.

The upstream pipeline computes detector-bucket speed as sum(lane speed × lane volume) / sum(lane volume), with its existing zero-volume fallback. It filters invalid source rows and out-of-range speed/occupancy. The D2 module uses already-cleaned aggregates, rejecting nonnumeric or out-of-range speeds. Within a time bin, network speed is the arithmetic mean across valid detectors. Across a selected window, regional and road statistics are pooled detector-bucket means; detectors with more observed buckets receive more total weight. Sample counts must therefore accompany comparisons.

Low speed is defined as speed <20 km/h AND sampled volume >0. This is an interpretable screening threshold chosen by the project, not an official universal congestion definition. A traffic signal, urban road geometry or sensor issue may also produce low speed. The low-speed share is the number of low-speed detector-buckets divided by all valid detector-buckets; valid zero-volume buckets remain in that denominator, consistently with the team definition. Coverage uses fresh matching detectors divided by matching catalog detectors, with the full catalog containing 807 entries. Freshness means an underlying observation no more than 15 minutes before the chosen reference time. Empty groups show no estimate, not an invented zero speed.

All time classifications use Asia/Hong_Kong (UTC+8). AM peak is [07:00,10:00), PM peak is [17:00,20:00), and other hours are off-peak. Saturday and Sunday are weekend days; public holidays are not separately classified. A low-speed run is computed independently for each detector, requiring successive bucket starts exactly 15 minutes apart. Missing buckets, non-low-speed buckets and zero-volume buckets break a run. Multiplying the run length by 15 estimates bucket coverage, not continuously observed congestion. Runs of at least six hours are flagged for review; the flag is a heuristic, not proof of a faulty sensor.

Relative slowdown means speed <50% of that detector's preceding-history median with positive current volume. At least 96 preceding positive-volume buckets spanning 48 hours are required. The query includes an extra 72 hours before the selected window; the median uses available preceding rows only, never future rows. This preliminary baseline is not adjusted for hour of day or road speed limit. 2256 of 290650 eligible observations meet the rule (0.78%).

The aliases Central and Western and Central & Western are unified in the presentation layer. The original stored data is not rewritten. Other road-name spelling variants are retained pending source-owner review.

## 7. Traffic dashboard design and results

### Analysis coverage

The fixed seed reference is 16 November 2026 09:15 HKT. The requested seven-day interval is 9 November 09:15 to 16 November 09:15; actual observed buckets begin on 10 November 10:15. This is approximately six days of data, not seven complete days. There are 427,918 valid detector-buckets from 780 detectors, across 5 weekday dates and 2 weekend dates (boundary dates are partial). The window mean is 72.73 km/h and 2588 buckets meet the low-speed rule (0.6%). These are monitored-road statistics, not a citywide travel-speed estimate.

The figures below were generated from the restored database after the existing backfill ran. Historical aggregates can be recomputed when source rows arrive. The saved JSON is the evidence for this draft; final submission should refresh evidence, screenshots and text together against the team's frozen database.

### City Overview

Four cards distinguish reference-time network speed, current low-speed detectors, coverage and historical low-speed share. The speed and sampled-count time series show timing and sample variability. A district ranking supports spatial comparison without pretending that different road mixes are directly comparable. The lowest observed district means are Wan Chai (55.33 km/h; n=5579), Kowloon City (58.19 km/h; n=18947), Tai Po (58.43 km/h; n=24301). This suggests locations for further inspection, not evidence that an entire district is congested.

### Road Network Map

The map shows the full catalog and supports district, road and direction filters. Missing, stale and zero-volume observations are gray. Popups and the companion table expose detector ID, speed, sampled volume, occupancy and source observation time. Selecting a historical reference reconstructs detector state from aggregate history; the current traffic_latest collection is not used to substitute newer observations into that history. Figure 2 demonstrates that coverage and a low-speed signal can be inspected together.

### Congestion and Time

| Road + direction | Mean km/h | Low-speed % | n | Detectors |
| --- | --- | --- | --- | --- |
| Hong Chong Road · South West | 42.3 | 30.65 | 558 | 1 |
| Lion Rock Tunnel Road · South West | 46.32 | 30.38 | 1672 | 4 |
| Kwun Tong Road · South East | 44.7 | 17.28 | 3344 | 6 |
| Lung Fu Road · South East | 56.73 | 10.39 | 558 | 1 |
| Gloucestor Road · East | 40.58 | 9.14 | 558 | 1 |

These ranks are descriptive. In particular, Hong Chong Road's leading result comes from one detector, so it should not be generalized to every segment of the road. The dashboard separately reports sample sizes and detector counts in exported tables.

| Group | Mean km/h | Low-speed % | Detector-buckets |
| --- | --- | --- | --- |
| Weekday · Off-peak | 73.7 | 0.44 | 218711 |
| Weekday · PM peak (17–20) | 67.73 | 1.77 | 36846 |
| Weekday · AM peak (07–10) | 69.5 | 1.57 | 25266 |
| Weekend · Off-peak | 73.25 | 0.38 | 110323 |
| Weekend · AM peak (07–10) | 73.49 | 0.32 | 18393 |
| Weekend · PM peak (17–20) | 71.64 | 0.5 | 18379 |

Weekday evening peak speed is lower than weekday off-peak speed in this sample. Weekend peak groups are also shown, but the sample includes only one weekend and unequal exposure. The hourly weekday/weekend plot and district-hour heatmap help locate the pattern rather than establish causation. No p-values or population-wide significance claims are made.

### Prolonged signal requiring review

The longest observed run belongs to AID07220 on Kwun Tong Road: 477 consecutive low-speed buckets (7155 estimated minutes), ending at the selected window boundary. Independent MongoDB inspection found speeds between 6.64 and 18.86 km/h across 560 available records for this detector, with positive sampled volume. This persistent signal may reflect local conditions or a measurement problem. It must not be reported as a confirmed multi-day traffic jam or a confirmed sensor fault. Review neighboring detectors, raw quality flags and road context before making an operational recommendation.

## Traffic findings and recommendations (editor to assign 8.1/8.2)

1. Network averages conceal localized low-speed signals. Prioritize location-level review with sample size and sensor coverage visible.
2. Weekday peak-period differences justify further matched comparisons using the same detectors and more weeks. They do not establish a causal peak-hour effect.
3. Validate unusually persistent low-speed detectors before ranking congestion severity or proposing interventions.
4. Expand observations to multiple complete weeks, normalize verified road aliases, and compare identical sensor panels. A road-class-specific threshold would be more defensible than a universal 20 km/h rule for operational use.

## Figure captions

- Figure D2-1 (01_overview.png): Fixed-reference network KPIs, traffic speed and sampled-count trends. The reference-time cards differ from pooled historical statistics.
- Figure D2-2 (02_map.png): Catalog-based detector map with speed legend and missing/stale handling; the table provides a non-map alternative.
- Figure D2-3 (03_congestion.png): Road low-speed ranking, weekday/weekend and peak-period comparisons, district-hour heatmap and duration review.
- Figure D2-4 (04_filtered_map.png): District filter demonstration; all counts and table rows follow the selected district.

## Sources and reproducibility

- Transport Department traffic feed: https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol-all.xml
- Transport Department detector catalog: https://static.data.gov.hk/td/traffic-data-strategic-major-roads/info/traffic_speed_volume_occ_info.csv
- Project data dictionary: ../DATA_DICTIONARY.md
- Evidence: evidence/analytics_7d.json, evidence/db_check.json, evidence/verify_analytics.json.
- Run node --test tests/traffic.test.js for numerical regression tests.
- Rebuild the D2 flow with node tools/build_traffic_dashboard.js after UI/analytics changes. This preserves other tabs.
- Start the stack with docker compose up -d --build and open http://localhost:1880/traffic.
