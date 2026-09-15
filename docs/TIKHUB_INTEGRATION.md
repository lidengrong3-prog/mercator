# TikHub 数据接入（第 14 步）

产品、店铺和内容页面只请求 `formal_publications` 的允许展示投影。原始响应、`raw_source_records`、实体和快照表仍由服务端保护；浏览器不会读取私有 Storage 或未授权 TikHub 字段。

## 来源分层

- 系统采集：正式历史投影生成的不可变快照，带市场、平台、来源 ID、证据哈希和 collected_at。
- 第三方可追溯：TikHub 数据的来源类别，不能显示成 TikTok 官方数据；只有授权并通过发布闸门的字段才会出现在正式投影。
- 工作区上传：当前工作区自己的 CSV/JSON 数据，保存和清空只影响工作区上传集合。

三类记录可以同时出现在筛选、详情和报告素材池中，稳定 ID 不会让一类记录覆盖另一类记录。系统快照按采集时间显示最新值和历史趋势；超过三天的快照标记为“已过期”，缺少必需字段会显示字段缺失数。

## 监控任务

`monitoring_tasks` 按工作区保存关键词、商品或店铺监控意图，包含市场、平台、类目、频率、下次执行时间和最近错误。前端通过 `jayCreateMonitoringTask()` 创建，通过 `jayLoadMonitoringTasks()` 查询；Worker 按任务类型只调用所需接口，按任务状态和来源授权入队，不能绕过市场范围或 TikHub 日预算。批量商品监控会逐条创建任务并返回成功/失败数量。

内容采集通过 `tikhub_content` Worker 任务执行，标准化结果写入 `content_entities/content_snapshots`。视频、达人、商品关联和互动指标都保留 `collected_at`；报告素材和引用必须使用该快照时间，不将当前值表述为长期事实。

授权完成后，审核人先通过 service-role 调用 `review_tikhub_publication()` 写入独立审核台账，确认记录和字段白名单；再调用 `promote_tikhub_formal_publications()`。该流程要求来源商业使用和公开再分发均已确认，原始证据保持不可变，并只复制字段白名单到正式投影；任何未满足条件的数据仍保持隔离状态。

## 上线国家范围

范围来自 data/market_scope.json。只有 status=active 且市场与平台关系 data_status=configured 的范围才会实际执行采集；schema_only、停用或未授权范围会显示覆盖状态但请求数为零。当前 US/TikTok Shop 可执行，ID/TikTok Shop 等待适配和授权。
