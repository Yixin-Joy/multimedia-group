const fs=require('fs'),assert=require('assert/strict');
const a=JSON.parse(fs.readFileSync('docs/evidence/analytics_7d.json','utf8'));
const b=JSON.parse(fs.readFileSync('docs/evidence/db_check.json','utf8').replace(/^\uFEFF/,''));
assert.equal(a.summary.n,b.overall[0].n);assert.equal(a.summary.slow,b.overall[0].slow);assert(Math.abs(a.summary.speed-b.overall[0].speed)<.006);
const table=(head,rows)=>'| '+head.join(' | ')+' |\n| '+head.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n');
const peakTable=table(['Group','Mean km/h','Low-speed %','Detector-buckets'],a.peaks.map(r=>[r.name,r.speed,r.slowShare,r.n]));
const roadTable=table(['Road + direction','Mean km/h','Low-speed %','n','Detectors'],a.roads.slice(0,5).map(r=>[r.name,r.speed,r.slowShare,r.n,r.detectors]));
const source='https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol-all.xml';
const catalog='https://static.data.gov.hk/td/traffic-data-strategic-major-roads/info/traffic_speed_volume_occ_info.csv';
const en=`# D2 — Traffic use case, methodology and results

Evidence generated: ${a.generatedAt}. Source repository baseline: 94b9380816a09b4820367b346683dfa0065333ff. This is the traffic contribution, not the complete three-person report. The work plan gives inconsistent 8.1/8.2 numbering; the editor should place Traffic Recommendations by heading, then renumber.

## 1.2 Traffic use case and objectives

The traffic module supports a progression from overview to location and temporal diagnosis. It asks: which monitored locations are slow, when is low speed more common, and does an apparent long episode require traffic investigation or sensor-quality review? The intended user is an analyst inspecting monitored Hong Kong roads, not a driver receiving a guaranteed real-time route recommendation.

## 6. Traffic data analytics methodology

The dashboard queries traffic_detector_15m and the detector catalog. Current and historical states are derived from the same bounded aggregate history so that historical maps cannot accidentally show today's observations. The original collection and cleaning flows remain intact. Node-RED serves the interface and read-only MongoDB queries; no additional dashboard palette is required. Leaflet 1.9.4 is bundled locally, while OpenStreetMap background tiles require internet access.

The upstream pipeline computes detector-bucket speed as sum(lane speed × lane volume) / sum(lane volume), with its existing zero-volume fallback. It filters invalid source rows and out-of-range speed/occupancy. The D2 module uses already-cleaned aggregates, rejecting nonnumeric or out-of-range speeds. Within a time bin, network speed is the arithmetic mean across valid detectors. Across a selected window, regional and road statistics are pooled detector-bucket means; detectors with more observed buckets receive more total weight. Sample counts must therefore accompany comparisons.

Low speed is defined as speed <20 km/h AND sampled volume >0. This is an interpretable screening threshold chosen by the project, not an official universal congestion definition. A traffic signal, urban road geometry or sensor issue may also produce low speed. The low-speed share is the number of low-speed detector-buckets divided by all valid detector-buckets; valid zero-volume buckets remain in that denominator, consistently with the team definition. Coverage uses fresh matching detectors divided by matching catalog detectors, with the full catalog containing 807 entries. Freshness means an underlying observation no more than 15 minutes before the chosen reference time. Empty groups show no estimate, not an invented zero speed.

All time classifications use Asia/Hong_Kong (UTC+8). AM peak is [07:00,10:00), PM peak is [17:00,20:00), and other hours are off-peak. Saturday and Sunday are weekend days; public holidays are not separately classified. A low-speed run is computed independently for each detector, requiring successive bucket starts exactly 15 minutes apart. Missing buckets, non-low-speed buckets and zero-volume buckets break a run. Multiplying the run length by 15 estimates bucket coverage, not continuously observed congestion. Runs of at least six hours are flagged for review; the flag is a heuristic, not proof of a faulty sensor.

Relative slowdown means speed <50% of that detector's preceding-history median with positive current volume. At least 96 preceding positive-volume buckets spanning 48 hours are required. The query includes an extra 72 hours before the selected window; the median uses available preceding rows only, never future rows. This preliminary baseline is not adjusted for hour of day or road speed limit. ${a.relative.count} of ${a.relative.eligible} eligible observations meet the rule (${a.relative.share}%).

The aliases Central and Western and Central & Western are unified in the presentation layer. The original stored data is not rewritten. Other road-name spelling variants are retained pending source-owner review.

## 7. Traffic dashboard design and results

### Analysis coverage

The fixed seed reference is 16 November 2026 09:15 HKT. The requested seven-day interval is 9 November 09:15 to 16 November 09:15; actual observed buckets begin on 10 November 10:15. This is approximately six days of data, not seven complete days. There are ${a.summary.n.toLocaleString('en')} valid detector-buckets from ${a.summary.detectors} detectors, across ${a.dayCounts.Weekday} weekday dates and ${a.dayCounts.Weekend} weekend dates (boundary dates are partial). The window mean is ${a.summary.speed} km/h and ${a.summary.slow} buckets meet the low-speed rule (${a.summary.slowShare}%). These are monitored-road statistics, not a citywide travel-speed estimate.

The figures below were generated from the restored database after the existing backfill ran. Historical aggregates can be recomputed when source rows arrive. The saved JSON is the evidence for this draft; final submission should refresh evidence, screenshots and text together against the team's frozen database.

### City Overview

Four cards distinguish reference-time network speed, current low-speed detectors, coverage and historical low-speed share. The speed and sampled-count time series show timing and sample variability. A district ranking supports spatial comparison without pretending that different road mixes are directly comparable. The lowest observed district means are ${a.districts.slice(0,3).map(r=>r.name+' ('+r.speed+' km/h; n='+r.n+')').join(', ')}. This suggests locations for further inspection, not evidence that an entire district is congested.

### Road Network Map

The map shows the full catalog and supports district, road and direction filters. Missing, stale and zero-volume observations are gray. Popups and the companion table expose detector ID, speed, sampled volume, occupancy and source observation time. Selecting a historical reference reconstructs detector state from aggregate history; the current traffic_latest collection is not used to substitute newer observations into that history. Figure 2 demonstrates that coverage and a low-speed signal can be inspected together.

### Congestion and Time

${roadTable}

These ranks are descriptive. In particular, Hong Chong Road's leading result comes from one detector, so it should not be generalized to every segment of the road. The dashboard separately reports sample sizes and detector counts in exported tables.

${peakTable}

Weekday evening peak speed is lower than weekday off-peak speed in this sample. Weekend peak groups are also shown, but the sample includes only one weekend and unequal exposure. The hourly weekday/weekend plot and district-hour heatmap help locate the pattern rather than establish causation. No p-values or population-wide significance claims are made.

### Prolonged signal requiring review

The longest observed run belongs to ${a.episodes[0].detectorId} on ${a.episodes[0].road}: ${a.episodes[0].buckets} consecutive low-speed buckets (${a.episodes[0].minutes} estimated minutes), ending at the selected window boundary. Independent MongoDB inspection found speeds between ${b.prolonged[0].min} and ${b.prolonged[0].max} km/h across ${b.prolonged[0].n} available records for this detector, with positive sampled volume. This persistent signal may reflect local conditions or a measurement problem. It must not be reported as a confirmed multi-day traffic jam or a confirmed sensor fault. Review neighboring detectors, raw quality flags and road context before making an operational recommendation.

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

- Transport Department traffic feed: ${source}
- Transport Department detector catalog: ${catalog}
- Project data dictionary: ../DATA_DICTIONARY.md
- Evidence: evidence/analytics_7d.json, evidence/db_check.json, evidence/verify_analytics.json.
- Run node --test tests/traffic.test.js for numerical regression tests.
- Rebuild the D2 flow with node tools/build_traffic_dashboard.js after UI/analytics changes. This preserves other tabs.
- Start the stack with docker compose up -d --build and open http://localhost:1880/traffic.
`;
fs.writeFileSync('docs/D2_REPORT_EN.md',en);
fs.writeFileSync('docs/D2_REPORT_ZH.md',`# 分工二：交通分析报告与讲解要点

这是可交给报告主编的交通部分，不是整个小组最终报告。英文正文在 D2_REPORT_EN.md。原分工文档的 8.1/8.2 编号前后冲突，主编应按“交通建议”标题合并后统一编号。

## 研究目标

从“整体运行情况如何”进入“哪些位置值得关注”，再看“低速是否集中在特定时段、是否持续”。三个页面分别承担总览、空间定位和时间诊断。我们监测的是有探测器覆盖的道路，不声称代表所有香港道路。

## 数据与计算口径

- 使用同学已清洗的 traffic_detector_15m 和探测器目录，不重复扫描数百万条原始车道数据。
- 车道到探测器：沿用后台按流量加权的速度；检测点到全网：有效检测点速度的算术平均。历史整体、地区、道路均值按检测点×时间桶汇总，观测多的探测器权重更大。
- 低速：速度严格小于 20 km/h，且流量大于 0。该阈值是项目筛选规则，不是官方通用拥堵标准。分母为全部有效检测点时间桶，包括有效但零流量的桶。
- 覆盖率：参考时间前15分钟内有有效观测的检测点数 / 所选目录检测点数。全目录807个。快照模式用历史参考时间；Live 用当前时钟。
- 早高峰07:00–10:00，晚高峰17:00–20:00；周六日为周末，未另处理公众假日。全部为香港时间。
- 连续低速必须是同一检测点、相邻桶相差恰好15分钟；缺测、非低速、零流量都会中断。桶数×15只是估计覆盖时长，不能宣称每秒都堵。
- 相对降速：低于该检测点此前速度中位数的50%，且当前流量为正；至少96个历史正流量桶并跨越48小时。基准不使用未来记录，但尚未做同小时对照。
- 合并中西区的两种英文写法；不修改原数据库。其他道路拼写变体暂保留。

## 本次真实结果

报告窗口截至2026-11-16 09:15 HKT；选择“Last 7 days”不代表已有完整7天。首个观测桶为11月10日10:15，实际约六天，含5个工作日日期、2个周末日期，边界日期不完整。

共 ${a.summary.n} 个有效检测点时间桶、${a.summary.detectors} 个有历史记录的检测点；历史平均速度 ${a.summary.speed} km/h；低速桶 ${a.summary.slow} 个，占 ${a.summary.slowShare}%。这些数字来自本机恢复并运行后台回填后的数据库，可能与原压缩种子的静态说明略有变化，证据保存在 evidence 文件夹。

### 发现一：整体均值会掩盖局部低速

${roadTable}

红磡道路（Hong Chong Road）对应方向的低速占比较高，但只有1个检测点，不能扩展为整条道路都同样拥堵。必须同时看样本数、点位数量及地图位置。

### 发现二：工作日高峰与非高峰存在描述性差异

${peakTable}

本样本工作日晚高峰平均速度比非高峰低。不能据此声称高峰“导致”了差异；路段组成、检测点缺测、日期样本不均等都会影响结果。这里只有一个周末，应继续收集数周并在相同检测点上比较。

### 发现三：最长低速记录更应触发数据核查

${a.episodes[0].detectorId} 在 ${a.episodes[0].road} 有 ${a.episodes[0].buckets} 个连续低速桶，估计 ${a.episodes[0].minutes} 分钟。数据库独立复核该点速度范围为 ${b.prolonged[0].min}–${b.prolonged[0].max} km/h，不能直接说“堵了几天”，也不能断言传感器坏了。页面把超过6小时的记录标为需复核；建议与邻近探测器、原始质量标志和道路环境交叉检查。

相对降速符合条件的样本为 ${a.relative.count}/${a.relative.eligible}（${a.relative.share}%），与固定20 km/h阈值含义不同。

## 建议与限制

1. 先定位低速点，再核对传感器质量，最后讨论管理建议。
2. 增加多周完整数据、道路类型和限速背景；不要用一个阈值简单判断所有道路。
3. 采样流量是已采集源记录的车辆计数之和，不是完整交通总流量。
4. 快照固定的是时间范围，不是数据库不可变副本；正式提交前由分工一冻结数据，再同步更新报告、截图和统计。
5. 地图底图需要网络；Leaflet代码已本地打包，底图失败时保留检测点和表格。

## 对主编的交接

使用英文正文中的 Traffic Use Case、Methodology、Results、Traffic Recommendations 四部分；插入 screenshots 文件夹图片。与天气章节衔接：交通本身已有时段和空间差异，天气分析需要考虑这些差异，不能把所有速度变化归因于降雨。
`);
for(const k of ['trend','districts','roads','peaks','hourly','episodes']){const rows=a[k],keys=Object.keys(rows[0]||{});fs.writeFileSync('docs/evidence/'+k+'.csv','\uFEFF'+[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n'));}
fs.writeFileSync('docs/evidence/reconciliation.json',JSON.stringify({checkedAt:new Date().toISOString(),countMatch:true,lowSpeedMatch:true,roundedMeanMatch:true,api:a.summary,database:b.overall[0]},null,2));
console.log('Reports and CSV evidence written; independent database checks match.');
