# 分工二交接说明

## 打开

在此项目文件夹运行 `docker compose up -d --build`，浏览器打开 **http://localhost:1880/traffic**。`http://localhost:1880` 是 Node-RED 编辑器。

本机这次使用独立项目名，因此在本机继续启动请用 `docker compose -p multimedia-d2 up -d --build`，避免另建一套数据库和端口冲突。MongoDB种子分为4部分，均已保留在完整包中。

默认显示 Historical snapshot（历史快照）的固定时间窗（截至2026-11-16 09:15 HKT）。可切换 Latest available snapshot 或 Live；实时数据断档时不把旧数据伪装成新数据。快照只锁定时间范围，后台回填仍可能更新历史桶；报告使用保存的 evidence JSON。初次还原数百万记录需要数分钟。

## 文件

- `dashboard/index.html`、`app.js`、`style.css`：英文交通界面。
- `dashboard/analytics.js`：统计算法。
- `dashboard/traffic-flow.json`：仅分工二页签，用于合并。
- `node-red-data/flows.json`：包含原采集/清洗页签的完整流程。
- `tools/build_traffic_dashboard.js`：把源码打入 Node-RED 流程，重复运行不新增重复节点。
- `tests/traffic.test.js`：计算边界测试。
- `docs/D2_REPORT_EN.md` / `D2_REPORT_ZH.md`：英文报告素材、中文讲解。
- `docs/D2_DEMO.md`：演示脚本。
- `docs/evidence`：真实统计 JSON、CSV 和独立数据库复核。
- `docs/screenshots`：真实运行截图。

## 对分工一：如何合并

1. 先导出备份你服务器现有完整 Flow。
2. 在现有 Node-RED 导入 `dashboard/traffic-flow.json`，只新增 D2 Traffic Dashboard 页签。不要用本包完整流程覆盖同学后续已修改的其他页签。
3. D2 MongoDB 节点复用现有 client ID `9000000000000001`；如果你的实例ID不同，为这3个查询节点重新选择 `smartcity` 连接。
4. 只需现有 `node-red-contrib-mongodb4`；界面由原生 HTTP 节点服务，不增加 Dashboard 插件，不改采集/清洗逻辑。
5. Deploy 后打开 `/traffic`，检查 API、筛选和时间范围。路由统一位于 `/traffic`，避免与分工三冲突。
6. 已有 node-red-state 命名卷不会因 Docker rebuild 自动覆盖 flows.json。合并通过编辑器导入；**不要删除MongoDB数据卷**。

## 对分工三：整合接口

- 页面地址 `/traffic#overview`、`/traffic#map`、`/traffic#congestion`。
- 公共颜色、间距在 `style.css` 的 CSS变量中，可统一修改。
- 查询：`GET /traffic/api/analytics?mode=seed&hours=168&district=Kwun%20Tong`。
- 参数：mode=seed/snapshot/live；hours=1/6/24/168；district、road、direction为可选精确匹配。返回窗口起止、样本数、分组结果、连续低速段和相对降速。
- `GET /traffic/api/catalog` 返回探测器目录及当前latest；历史页面的实际状态取analytics.latest，以防历史图混入当前数据。
- 查询只读。SQL式原始表达式不会从URL注入；所有筛选按字符串比较。
- 交通报告章节编号按标题合并：原分工表8.1/8.2前后不一致，避免机械复制编号。

## 对应任务

| 任务 | 交付 |
|---|---|
| D2-01 | KPI、时间趋势、覆盖率、低速数 |
| D2-02 | Leaflet地图、速度图例、地区/道路/方向筛选、弹窗和表格 |
| D2-03 | 地区速度排序图、CSV数据表 |
| D2-04 | 道路低速排行、连续低速段、高峰分析、相对降速 |
| D2-05 | 工作日与周末小时曲线、分组样本数 |
| D2-06 | 自动回归测试、数据库复核及浏览器验收 |
| D2-07 | 中英文交通报告素材 |
| D2-08 | 真实页面截图、结果CSV和图注 |
| D2-09 | 三分钟演示脚本 |

正式提交前仍需要小组完成：分工三天气页/整体整合，分工一冻结最终数据和技术验收。不能将本包描述为全组三人最终成品。

## 更新源码

修改 dashboard 源码后运行 `node tools/build_traffic_dashboard.js`，再导入新D2流程。不要单独运行原来的 `tools/build_flows.js` 后忘记重建D2，它会重写完整流程。

报告更新：先重新保存固定窗口的API JSON和同窗口数据库统计，再运行 `node tools/write_d2_report.js`；脚本会检查总数、低速数、均速是否一致。最后重新截图，确保图文同步。
