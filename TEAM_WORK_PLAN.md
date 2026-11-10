# 香港天气与交通智慧城市项目分工与 Dashboard 设计

更新日期：2026-11-10

## 文档目的

本文档用于统一三人的 Development 范围、Dashboard 页面设计、数据依赖、交付时间与验收标准。

**统计口径：本聊天框内已经完成的所有分析、接口验证、Flow、Docker、服务器迁移、数据清洗设计、数据快照和仓库整理工作，全部计入分工 1，并标记为已完成。**

状态标记：

- ✅ 已完成
- 🟡 进行中
- ⬜ 未开始

## 项目范围

项目主题为香港天气与道路交通运行分析，使用 DATA.GOV.HK 官方开放数据：

- 运输署主要道路车速、车流量和占有率
- 运输署交通检测点位置与道路资料
- 香港天文台过去一小时自动气象站降雨量

原始停车选题已经停止，停车相关 MongoDB 集合已删除。

## 当前数据基础

仓库种子数据：

| 数据 | 数量 |
|---|---:|
| 交通车道观测 | 314,804 |
| 交通检测点目录 | 807 |
| 降雨站观测 | 936 |

当前数据特征：

- 活跃交通检测点约 771 个
- 覆盖 19 个地区
- 雨量站 36 个
- 已有约 6 小时历史数据
- 目前尚没有正降雨样本

因此：

- Traffic Overview、地图、时间趋势和低速分析可以立即开发。
- Weather Impact 页面可以开发，但必须支持“暂无有雨样本”的空状态。
- 工作日/周末和长期拥堵分析需等待数据继续积累。

## Dashboard 信息架构

建议共 4 个主页面，并在公共页头显示数据健康状态。

### 公共页头

所有页面顶部统一显示：

- 数据最新更新时间
- 数据延迟
- 当前时间范围
- 检测点覆盖率
- 数据健康状态

数据健康颜色：

| 颜色 | 条件 |
|---|---|
| 绿色 | 最新交通数据延迟小于 10 分钟且覆盖率不低于 80% |
| 黄色 | 延迟 10-30 分钟或覆盖率 60%-80% |
| 红色 | 延迟超过 30 分钟或覆盖率低于 60% |

### Page 1: City Overview

目标：让用户快速了解当前城市交通状态与数据可用性。

组件：

| 组件 | 类型 | 内容 |
|---|---|---|
| Network Speed | KPI 卡片 | 当前有效检测点平均速度 |
| Slow Segments | KPI 卡片 | 速度低于 20 km/h 且车流量大于 0 的检测点数 |
| Rainfall Status | KPI 卡片 | 有雨站数、全网平均雨量 |
| Data Coverage | KPI 卡片 | 当前有数据检测点 / 807 |
| Speed Trend | 折线图 | 最近 24 小时平均速度 |
| District Ranking | 横向条形图 | 19 个地区平均速度 |
| Latest Alerts | 表格 | 最低速检测点、数据异常、延迟数据 |

主要内容层级：

1. KPI 卡片
2. 速度趋势与降雨趋势
3. 地区排行
4. 数据质量告警

### Page 2: Road Network Map

目标：展示当前道路速度的空间分布。

组件：

| 组件 | 类型 | 内容 |
|---|---|---|
| Speed Map | World Map | 每个检测点最新状态 |
| District Filter | 下拉框 | 地区筛选 |
| Road Filter | 搜索/下拉框 | 道路筛选 |
| Direction Filter | 下拉框 | 方向筛选 |
| Speed Legend | 图例 | 红/橙/黄/绿速度分级 |
| Segment Details | 表格或弹窗 | 速度、车流量、占有率、更新时间 |

地图颜色：

| 速度 | 颜色 | 状态 |
|---|---|---|
| `<20 km/h` | 红色 | Severe Slowdown |
| `20-40 km/h` | 橙色 | Slow |
| `40-60 km/h` | 黄色 | Moderate |
| `>=60 km/h` | 绿色 | Smooth |
| 超过 15 分钟未更新 | 灰色 | Stale |

注意：

- 以检测点为最小展示单位，不把每条车道重复计入“拥堵路段数”。
- 地图上只展示最新可用记录，并显示时间。
- `roadEn` 需要提取 `roadBase`，防止把同一道路的不同 `near` 描述当成不同道路。

### Page 3: Congestion and Time

目标：回答“哪里慢、什么时候慢、是否持续慢”。

组件：

| 组件 | 类型 | 内容 |
|---|---|---|
| Speed and Volume | 双轴折线图 | 平均速度与车流量 |
| Time Heatmap | 热力图 | 小时 × 地区平均速度 |
| Slowest Detectors | 排行榜 | 平均速度最低的检测点 |
| Slowest Roads | 排行榜 | 归一化道路与方向排行 |
| Congestion Duration | 条形图 | 低速持续 15 分钟桶数 |
| Working Day Comparison | 分组柱状图 | 工作日、周末、高峰、非高峰 |
| Relative Slowdown | 表格 | 低于自身历史中位数 50% 的检测点 |

低速定义：

```text
speedKmh < 20 AND volume > 0
```

相对减速在积累至少 2-3 天后启用：

```text
current speed < 50% of detector historical median speed
```

### Page 4: Weather Impact

目标：分析降雨期间交通速度是否出现统计差异。

组件：

| 组件 | 类型 | 内容 |
|---|---|---|
| Network Rainfall | 折线图 | 15 分钟全网平均与最大雨量 |
| Raining Stations | KPI/折线 | 有雨站数量 |
| Speed by Rain Category | 分组柱状图 | 不同雨量等级平均速度 |
| Slow Share by Rain | 折线/柱状图 | 不同雨量等级低速占比 |
| Weather Coverage | 表格 | 匹配与未匹配天气样本 |
| Station Ranking | 表格 | 雨量站排行 |

雨量分类：

| 分类 | 15 分钟网络平均雨量 |
|---|---|
| No Rain | 0 mm |
| Light | `>0` 且 `<1` mm |
| Moderate | `>=1` 且 `<5` mm |
| Heavy | `>=5` mm |

页面必须显示样本数。当前没有正降雨样本时显示：

```text
No rainfall events collected yet.
Weather comparison will be enabled after rainy samples are available.
```

结论只能描述统计关联，不能写成“降雨导致拥堵”等因果结论。

## Visual Design

UI 使用英文标签，与官方数据字段和课程报告保持一致。

| 元素 | 建议颜色 |
|---|---|
| 页面背景 | `#F5F7FA` |
| 主标题/正文 | `#17324D` |
| 主强调色 | `#1565A8` |
| 天气 | `#1D8AC7` |
| 畅通 | `#2E8B57` |
| 一般 | `#D7A91E` |
| 缓慢 | `#E68422` |
| 严重低速 | `#C83E4D` |
| 数据异常 | `#6B7280` |

布局规则：

- KPI 卡片占首屏顶部。
- 地图和时间趋势是主要视觉元素。
- 表格只用于可排序排行和样本明细。
- 所有图表显示单位、时间范围、样本量。
- 空数据、少量样本和过期数据必须显式提示。

## Data Cleaning Architecture

原始集合不得被删除或覆盖：

- `traffic_observations`
- `traffic_detector_catalog`
- `rainfall_observations`

### Traffic cleaning

基础过滤：

```javascript
{
  valid: true,
  speedKmh: { $gte: 0, $lte: 200 },
  occupancyPct: { $gte: 0, $lte: 100 }
}
```

检测点 15 分钟聚合：

```text
avgSpeedKmh = sum(speedKmh * volume) / sum(volume)
```

如果 `sum(volume)=0`：

- 可以使用平均车道速度展示。
- 不将零车流量记录计入拥堵数量。

道路名称归一化：

```text
roadBase = roadEn 中 "near" 之前的部分
direction = roadEn 最后一个 "-" 之后的文字
```

### Weather cleaning

| 原值 | 处理 |
|---|---|
| 数字 | 保存数字 |
| `T` | `rainfallMm=0`，`qualityFlag=trace` |
| `M` | `rainfallMm=null`，`qualityFlag=missing` |

天气聚合：

- `networkAvgMm` 只计算有效站
- `networkMaxMm` 使用有效站最大雨量
- 记录 `rainingStations`
- 记录 `missingStations`

### Time and join

- MongoDB 保存 UTC `Date`
- Dashboard 转换为 `Asia/Hong_Kong`
- 交通与天气都统一到 15 分钟桶
- 未匹配天气不能按 0 雨量处理
- 显示 `weatherMatched` 和天气样本覆盖率

## Derived Collections

| 集合 | 粒度 | Owner |
|---|---|---|
| `traffic_latest` | 每个检测点最新状态 | 分工 1 |
| `traffic_detector_15m` | 检测点 × 15 分钟 | 分工 1 |
| `traffic_road_hourly` | 道路 × 方向 × 小时 | 分工 1/2 |
| `rainfall_15m` | 天气时间点 | 分工 1 |
| `traffic_weather_15m` | 检测点 × 15 分钟 + 天气 | 分工 1/3 |
| `data_quality_snapshots` | 每轮清洗状态 | 分工 1 |

详细字段见 [DATA_DICTIONARY.md](DATA_DICTIONARY.md)。

## Team Division

### 分工 1：数据工程、集成、部署与数据健康

负责人负责：

- API 验证与采集
- Node-RED 采集 Flow
- MongoDB Schema、去重、重试和索引
- Docker 仓库与自动初始化
- 服务器迁移与持续运行
- 数据清洗 Flow
- 数据分析集合
- 数据质量页面
- 最终数据导出与提交包

已完成：

| ID | 工作 | 状态 |
|---|---|---|
| D1-01 | 选题分析与两个官方数据源确认 | ✅ |
| D1-02 | 交通、天气 API 实际连通性与字段验证 | ✅ |
| D1-03 | Node-RED 交通与天气采集 Flow | ✅ |
| D1-04 | MongoDB 入库、确定性 `_id` 和重复检测 | ✅ |
| D1-05 | HTTP 失败 30 秒自动重试 | ✅ |
| D1-06 | Dockerfile、Compose、MongoDB 索引 | ✅ |
| D1-07 | 停车分支停止与停车集合删除 | ✅ |
| D1-08 | 本地数据快照与迁移包 | ✅ |
| D1-09 | 服务器部署、历史恢复和远程接管 | ✅ |
| D1-10 | GitHub-ready 仓库结构、自动 Flow 加载 | ✅ |
| D1-11 | MongoDB 种子自动恢复 | ✅ |
| D1-12 | README、数据字典和首次启动测试 | ✅ |
| D1-13 | 当前数据质量审计 | ✅ |
| D1-14 | Dashboard 信息架构、清洗规则和分工设计 | ✅ |

分工 1 后续任务：

| ID | 工作 | 交付物 | 目标日期 |
|---|---|---|---|
| D1-15 | 实现 `traffic_latest` 和 `traffic_detector_15m` | 清洗 Flow + 集合 | 11-12 |
| D1-16 | 实现 `rainfall_15m` 和 `traffic_weather_15m` | 天气聚合集合 | 11-13 |
| D1-17 | 实现 `traffic_road_hourly` | 道路小时聚合 | 11-14 |
| D1-18 | 数据健康监控与异常样本表 | Data Health 组件 | 11-15 |
| D1-19 | 远程数据定期快照 | 最新 seed archive | 11-23 |
| D1-20 | 11-29 最终数据导出、验证与提交包 | 最终 MongoDB 数据 | 11-29 |

### 分工 2：交通分析与地图

负责人负责：

- City Overview 中交通 KPI
- Road Network Map
- Congestion and Time
- 低速与相对减速逻辑
- 交通分析结论

任务：

| ID | 工作 | 依赖 | 目标日期 |
|---|---|---|---|
| D2-01 | 实现交通 KPI 查询节点 | D1-15 | 11-13 |
| D2-02 | 实现最新检测点地图与速度图例 | D1-15 | 11-14 |
| D2-03 | 实现地区、道路、方向筛选 | D1-15 | 11-15 |
| D2-04 | 实现速度/车流量时间趋势 | D1-15 | 11-15 |
| D2-05 | 实现低速检测点和道路排行 | D1-17 | 11-17 |
| D2-06 | 实现低速持续时间和相对减速 | D1-17 | 11-19 |
| D2-07 | 实现工作日/周末与高峰分析 | 持续数据 | 11-22 |
| D2-08 | 输出交通 Insight 和报告段落 | D2-01 至 D2-07 | 11-24 |

### 分工 3：天气分析、UI 整合与报告

负责人负责：

- Weather Impact 页面
- Dashboard 统一布局与视觉样式
- 空状态、样本量提示和移动端适配
- 报告结构、图表截图和最终排版

任务：

| ID | 工作 | 依赖 | 目标日期 |
|---|---|---|---|
| D3-01 | 实现雨量时间趋势与站点排行 | D1-16 | 11-15 |
| D3-02 | 实现雨量分类和空状态 | D1-16 | 11-16 |
| D3-03 | 实现雨天速度与低速占比对比 | D1-16 | 11-18 |
| D3-04 | 统一 4 个 Dashboard 页面视觉样式 | D2-02/D2-04 | 11-18 |
| D3-05 | 实现公共页头与数据健康状态 | D1-18 | 11-19 |
| D3-06 | 移动端、空数据和异常状态测试 | 全部组件 | 11-22 |
| D3-07 | 编写天气分析 Insight | 持续天气数据 | 11-24 |
| D3-08 | 报告结构、图表截图、排版和提交检查 | 全部分析 | 11-27 |

## Shared Working Rules

- 原始集合只能追加，清洗规则更新通过派生集合重建完成。
- 每个派生文档使用确定性 `_id`，支持重复执行。
- 每人只修改自己负责的 flow tab，避免同时改 `flows.json`。
- 合并 Flow 时由分工 1 重新生成和验证运行版本。
- 任何 Dashboard 图表必须显示时间范围和样本量。
- 没有足够数据时显示空状态，不生成占位趋势或虚构结论。
- Dashboard 时间统一使用 `Asia/Hong_Kong`。
- 所有结论区分事实、统计关联和解释。

## Milestones

| 日期 | 里程碑 |
|---|---|
| 11-10 | 仓库、采集、种子数据和整体设计完成 |
| 11-13 | 清洗集合与交通 KPI 可用 |
| 11-16 | 地图、趋势和天气基础页面可用 |
| 11-19 | 4 个 Dashboard 主体与数据健康状态完成 |
| 11-22 | 全链路测试和指标修正完成 |
| 11-24 | 主要 Insight 和报告正文完成 |
| 11-27 | 报告、截图和演示版本完成 |
| 11-29 | 最终数据导出和版本冻结 |
| 11-30 | 提交 ZIP、链接和 Docker/Flow 验证 |
| 12-01 23:55 前 | Moodle 提交 |

## Acceptance Criteria

仓库：

- `docker compose up -d --build` 能从全新克隆启动
- Node-RED Flow 自动加载
- MongoDB 种子自动导入
- Flow 持续采集交通和降雨
- README 与数据字典字段一致

Dashboard：

- 四个主页面可访问
- 每个页面有时间范围和数据新鲜度
- 地图显示检测点最新状态
- 趋势和排行查询不直接扫描全部原始车道记录
- 无雨或低样本时显示明确空状态
- 时间正确显示为香港时间
- 低速数量按检测点统计，不按车道重复

数据：

- 原始数据和派生数据可区分
- 重复执行清洗不会重复创建记录
- 交通无效应被过滤
- 天气缺测不被当成 0
- 最终提交使用 11-29 导出数据

