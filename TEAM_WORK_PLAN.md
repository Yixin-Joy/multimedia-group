# 香港天气与交通项目后续分工

更新日期：2026-11-16

## 分工原则

项目的数据采集、清洗聚合、服务器部署、Docker 仓库、自动恢复和数据字典主要由分工 1 完成。为了平衡后续工作量，**分工 1 接下来主要负责数据运维、最终导出和技术章节；分工 2、分工 3 承担主要 Dashboard 开发、结果分析和报告撰写。**

剩余工作量建议比例：

| 成员 | 剩余工作量 |
|---|---:|
| 分工 1 | 约 20% |
| 分工 2 | 约 40% |
| 分工 3 | 约 40% |

本聊天框内已经完成的所有分析、API 验证、Flow、Docker、服务器迁移、数据聚合、数据回收、仓库和数据字典工作，均计入分工 1。

状态标记：

- ✅ 已完成
- 🟡 进行中
- ⬜ 未开始

## 当前已完成基础

| 项目 | 状态 |
|---|---|
| DATA.GOV.HK 交通与天文台雨量数据源验证 | ✅ |
| Node-RED 持续采集 Flow | ✅ |
| MongoDB 去重、重试和索引 | ✅ |
| Docker Compose 一键启动环境 | ✅ |
| 服务器持续采集 | ✅ |
| 15 分钟交通与天气聚合 | ✅ |
| 道路小时聚合 | ✅ |
| 最新检测点状态 `traffic_latest` | ✅ |
| 采集运行记录 `ingestion_runs` | ✅ |
| 原始交通 8 天 TTL、全周期聚合保留 | ✅ |
| 最近 7 天提交数据导出脚本 | ✅ |
| README、数据字典 | ✅ |
| GitHub 仓库与自动恢复 | ✅ |

当前累计数据包括数百万条原始交通观测、完整 15 分钟聚合、天气关联、道路小时聚合和采集运行记录。后续分析应优先查询聚合集合，不应直接扫描全部原始车道记录。

## Dashboard 页面归属

| 页面 | 主要内容 | 负责人 |
|---|---|---|
| City Overview | 平均速度、低速路段、数据覆盖率、24 小时趋势、地区排行 | 分工 2 |
| Road Network Map | 检测点地图、速度颜色、地区/道路筛选和详情 | 分工 2 |
| Congestion and Time | 高峰、低速排行、持续时间、工作日与周末 | 分工 2 |
| Weather Impact | 雨量趋势、天气分类、速度与低速占比比较 | 分工 3 |
| Data Health | 最新更新时间、采集次数、数据延迟和覆盖率 | 分工 3 负责 UI，分工 1 提供查询 |

Dashboard 统一使用英文 UI 标签。所有图表必须显示时间范围、单位、样本量，并明确处理数据延迟和空样本。

## 分工 1：数据运维、最终导出和技术报告

### 主要职责

- 维护服务器和数据采集
- 保证 15 分钟聚合持续更新
- 完成最终 7 天数据导出
- 编写系统架构、数据来源、存储和清洗章节
- 提供其他成员需要的稳定查询集合
- 完成最终技术验收和提交包

### 后续任务

| ID | 工作 | 交付物 | 截止日期 |
|---|---|---|---|
| D1-01 | 11-18 检查服务器、采集延迟、磁盘和聚合记录 | 简短状态记录 | 11-18 |
| D1-02 | 11-24 再检查一次服务器并更新 GitHub 种子 | 最新快照 + 状态 | 11-24 |
| D1-03 | 为分工 2、3 提供聚合集合查询说明 | 查询示例和字段说明 | 11-18 |
| D1-04 | 编写 Data Sources and Acquisition | 报告第 3 章 | 11-24 |
| D1-05 | 编写 System Architecture | 报告第 4 章 | 11-24 |
| D1-06 | 编写 Data Cleaning, Storage and Retention | 报告第 5 章 | 11-24 |
| D1-07 | 录制或整理 Docker/Node-RED 部署过程 | 附录截图和步骤 | 11-27 |
| D1-08 | 11-29 导出最近 7 天原始数据与全周期聚合 | 最终数据包 | 11-29 |
| D1-09 | 验证恢复、校验 SHA-256、整理最终提交 ZIP | 最终技术包 | 11-30 |

### 分工 1 报告章节

分工 1 负责技术内容，不负责大量结果讨论：

- 3. Data Sources and Acquisition
- 4. System Architecture
- 5. Data Storage, Cleaning and Retention
- Appendix A: Deployment and Reproduction
- Appendix B: Data Dictionary Summary

每章至少包含：

- 数据来源和官方链接
- 字段与时间粒度
- 去重、异常过滤和保留机制
- 架构图或 Flow 截图
- 技术限制和运行证据

## 分工 2：交通分析、地图与 Dashboard

### 主要职责

- 开发交通相关 Dashboard 页面
- 设计交通 KPI、低速、高峰和道路排行
- 从聚合集合查询数据
- 输出交通分析结果
- 撰写交通用例和分析报告章节

### 后续任务

| ID | 工作 | 交付物 | 截止日期 | 状态 |
|---|---|---|---|---|
| D2-01 | 实现 City Overview 的交通 KPI | 速度、低速数、覆盖率、24h 趋势 | 11-19 | ✅ |
| D2-02 | 实现 Road Network Map | 地图、颜色、筛选和详情 | 11-20 | ✅ |
| D2-03 | 实现地区平均速度排行 | 条形图和排序表 | 11-20 | ✅ |
| D2-04 | 实现 Congestion and Time | 低速排行、持续时间、高峰分析 | 11-22 | ✅ |
| D2-05 | 实现工作日与周末对比 | 分组图和分析说明 | 11-23 | ✅ |
| D2-06 | 验证交通指标和边界情况 | 指标测试记录 | 11-24 | ✅ |
| D2-07 | 编写交通分析章节 | 报告第 6、7 章 | 11-25 | ✅ |
| D2-08 | 准备 3-5 个交通结果截图及说明 | 图表和 Insight | 11-26 | ✅ |
| D2-09 | 完成交通 Dashboard 演示流程 | 演示脚本 | 11-27 | ✅ |

### 交通页面指标

- Network Speed：有效检测点平均速度
- Slow Segments：`speedKmh < 20` 且 `volume > 0`
- Coverage：有最新数据的检测点 / 807
- Peak vs Off-peak：早晚高峰与其余时段
- Congestion Duration：连续低速 15 分钟桶数量
- Relative Slowdown：速度低于检测点历史中位数 50%

### 分工 2 报告章节

- 1.2 Traffic Use Case and Objectives
- 6. Traffic Data Analytics Methodology
- 7. Traffic Dashboard Design and Results
- 8.1 Traffic Findings and Recommendations

交通章节必须包含：

- 低速阈值为什么合理
- 车道如何聚合到检测点
- 地图与时间分析展示的内容
- 哪些道路或地区经常低速
- 工作日、周末和高峰差异
- 分析局限，例如上游检测点缺测

## 分工 3：天气分析、整体 UI 与报告整合

### 主要职责

- 开发 Weather Impact 页面
- 统一所有 Dashboard 的视觉风格和布局
- 实现公共页头、时间范围和异常状态
- 负责跨页面测试和移动端适配
- 担任报告主编，整合三位成员内容

### 后续任务

| ID | 工作 | 交付物 | 截止日期 |
|---|---|---|---|
| D3-01 | 实现 Weather Impact 页面 | 雨量趋势、分类、样本数 | 11-20 |
| D3-02 | 处理无雨和低样本状态 | 空状态和说明文案 | 11-20 |
| D3-03 | 统一 Dashboard 样式和布局 | 公共主题、页头、间距 | 11-21 |
| D3-04 | 实现时间范围和筛选交互 | 1h、6h、24h、7d | 11-22 |
| D3-05 | 实现 Data Health 公共状态 | 最新时间、延迟、覆盖率 | 11-22 |
| D3-06 | 完成跨页面和移动端测试 | 测试清单 | 11-24 |
| D3-07 | 编写天气分析章节 | 报告第 8.2 节 | 11-25 |
| D3-08 | 编写 Introduction、Limitations and Conclusion | 报告第 1、9、10 章 | 11-26 |
| D3-09 | 整合全报告、统一术语和排版 | 完整报告初稿 | 11-28 |
| D3-10 | 生成最终截图、目录和提交检查 | 最终报告 | 11-30 |

### 天气页面指标

- Network rainfall：全网有效站平均雨量
- Raining stations：降雨量大于 0 的站点数
- Weather coverage：成功匹配天气的交通样本比例
- Speed by rain category：不同雨量等级的平均速度
- Slow share by rain category：不同雨量等级的低速占比
- Sample count：每类必须显示样本数

### 分工 3 报告章节

- 1. Introduction and Smart City Context
- 2. Weather Use Case and Objectives
- 8.2 Weather Impact Findings
- 9. Discussion and Limitations
- 10. Conclusion and Recommendations
- 全文术语、图表编号、目录和排版

报告主编负责检查：

- 三个人的术语一致
- 图表编号和正文引用一致
- 结论有样本支持
- 不把统计关联写成因果关系
- 所有截图与最终 Dashboard 版本一致

## 报告章节责任表

| 报告章节 | 主要内容 | 主负责人 |
|---|---|---|
| Cover / Abstract | 项目摘要、关键词 | 分工 3 |
| 1. Introduction | 智慧城市背景和项目目标 | 分工 3 |
| 2. Use Cases | 交通和天气用例 | 分工 2/3 |
| 3. Data Sources | 官方数据源和采集频率 | 分工 1 |
| 4. System Architecture | Node-RED、MongoDB、Docker、TTL | 分工 1 |
| 5. Data Cleaning and Storage | 清洗规则、聚合和保留机制 | 分工 1 |
| 6. Traffic Methodology | 检测点聚合、低速和高峰定义 | 分工 2 |
| 7. Traffic Results | 地图、趋势和拥堵洞察 | 分工 2 |
| 8.1 Weather/Traffic Relationship | 天气与速度统计关联 | 分工 3 |
| 8.2 Traffic Recommendations | 交通管理建议 | 分工 2 |
| 9. Discussion and Limitations | 数据缺测、样本量和因果限制 | 分工 3 |
| 10. Conclusion | 总结和建议 | 分工 3 |
| Appendix A | 部署和复现步骤 | 分工 1 |
| Appendix B | 数据字典摘要 | 分工 1 |

## 开发协作规则

- 分工 1 维护 `Cleaning and Analytics` 页签。
- 分工 2 只修改交通 Dashboard 相关页签和查询节点。
- 分工 3 负责天气、公共 UI 和最终整合。
- 每个人完成后导出完整 Node-RED Flow，由分工 1 合并并验证。
- 不要同时在 Node-RED 编辑同一个 Tab。
- 合并前先运行 `docker compose up -d --build` 和 `tools/verify_analytics.js`。
- 每人负责自己的图表截图和文字解释，报告主编只做统一和编辑。

## 时间计划

| 日期 | 里程碑 |
|---|---|
| 11-16 | 数据、聚合、Docker 和仓库基础完成 |
| 11-18 | 技术章节素材、聚合查询说明完成 |
| 11-20 | Overview、地图和 Weather Impact 初版 |
| 11-22 | 主要 Dashboard 页面完成 |
| 11-24 | 指标测试、数据状态检查和报告素材完成 |
| 11-25 | 交通和天气结果章节初稿 |
| 11-26 | 每个人的图表、Insight 和演示脚本完成 |
| 11-28 | 完整报告初稿和统一排版 |
| 11-29 | 最终数据导出、结果冻结 |
| 11-30 | ZIP、Docker、Flow、报告和数据最终检查 |
| 12-01 23:55 前 | Moodle 提交 |

## 最终验收

Dashboard：

- 四个主页面可访问
- 实时 KPI 和地图使用最新数据
- 趋势和天气分析使用最近 7 天
- 所有图表有单位、时间范围和样本量
- 无雨或低样本时显示明确空状态
- 香港时间显示正确

报告：

- 每个人完成自己负责的章节
- 报告数据与最终导出数据一致
- 所有图表与最终 Dashboard 一致
- 技术、结果、讨论和结论互相衔接
- 分工 3 完成统一排版，分工 1 完成技术复核

提交包：

- Node-RED Flow
- Docker/README/Data Dictionary
- 最近 7 天原始数据
- 全周期聚合数据
- 导出清单和 SHA-256
- 完整报告

