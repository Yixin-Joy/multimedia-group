# D2 verification record — 2026-11-17

## Environment and scope

- Windows host with Docker Desktop; isolated Compose project `multimedia-d2`.
- MongoDB 7.0, Node-RED 4.1.0, node-red-contrib-mongodb4 3.4.0.
- Source checkout: `94b9380816a09b4820367b346683dfa0065333ff`.
- Restored the real four-part GitHub seed; original collectors and analytics ran locally. This is not a verification of the teammate's remote server.

## Automated checks executed

- `node --test tests/traffic.test.js`: 9/9 passed (see evidence/unit_tests.txt).
- `node tools/verify_d2_http.js`: static routes, catalog uniqueness, no-data filter, combined district/road/direction query and preservation of original nodes passed (evidence/http_tests.json).
- Original `tools/verify_analytics.js` ran inside MongoDB (evidence/verify_analytics.json). This is a status dump, not by itself a pass/fail test.
- Independent MongoDB aggregation checked the fixed seven-day reference window. Count 427,918; low-speed buckets 2,588; unrounded mean 72.72525088918906 km/h. API results match after rounding (evidence/reconciliation.json).
- All 49 pre-existing collector/cleaning/config nodes compared structurally with Git HEAD and are unchanged.

## Interpretation checks

- Low-speed threshold is strict `<20`, positive volume required; zero-volume records do not form a congestion run.
- Missing 15-minute intervals break runs; different detectors never combine their run lengths.
- Hour/day classifications use Hong Kong time.
- Baseline statistics precede the evaluated record, avoiding future-data leakage.
- Fixed seed mode has a historical reference; live mode uses current clock time. Map states for historical windows come from bounded aggregate history, not newer traffic_latest records.
- A prolonged signal from AID07220 is documented as requiring investigation, not proof of continuous congestion or a sensor fault.

## Remaining team acceptance

The weather page and final shared shell belong to D3. The production-server merge, final frozen data export and full-group submission belong to D1/D3. Results from a different database refresh may differ, so rerun the report evidence and screenshots together before final submission. The prototype runs bounded histories in Node-RED memory; concurrent-user load testing and production hardening were not performed.

## Browser checks executed

- All three page routes opened with real data and English labels.
- Seven-day seed selection, district filter (Kwun Tong), road filter (Kwun Tong Road), direction (South East), and low-speed-only toggle exercised.
- SVG map marker click opened a popup with detector ID, speed, sampled volume, occupancy and time.
- 390-pixel mobile layout inspected; temporary viewport override reset after testing.
- Screenshots are captured from the running app, not synthetic mockups.
