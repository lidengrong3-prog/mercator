# TikHub 七天技术与合规试点

## 范围

试点按系统实际上线国家动态展开，不再固定美国。采集器读取 `data/market_scope.json`：只有 `status=active` 且市场与平台关系均为 `data_status=configured` 的范围才会执行 TikHub 请求；`schema_only`、停用或未授权范围会写入阻断覆盖记录，请求数为 0。当前 US/TikTok Shop 可执行，ID/TikTok Shop 已上线但仍为 `schema_only`，待适配和授权后自动进入同一链路。

每个可执行市场默认使用 20 个重点类目关键词，每天 1 次，可在授权后调整为每天 2 次，连续 7 天。商品/店铺试点按用途调用登记的 endpoint：关键词任务调用商品搜索、商品详情、卖家资料和店铺分析；单商品或单店铺监控只调用对应的 2 个 endpoint。每天关键词试点即每个市场 80 个请求；Worker 按市场拆分任务并通过 `tikhub` 来源预算原子限制请求数和估算费用。

内容数据使用独立的 `tikhub_content` 任务和四个独立 endpoint：视频搜索、视频详情、达人资料、视频与商品关联。内容任务同样按上线市场拆分，并写入 `content_entities/content_snapshots`；未完成授权、字段审查和正式晋级前不会显示在公众页面。

## 启用前检查

1. 在 Supabase 中确认 `tikhub_pilot_configs` 的 `authorization_status`、`status` 和 `enabled`，并确认 TikHub 商业使用条款允许保存及内部分析这些字段。
2. 在 Worker Secrets 中设置 `TIKHUB_API_KEY`、`SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`。API Key 不写入仓库、任务参数、日志或数据库。
3. 为四个 endpoint 设置 `TIKHUB_ENDPOINT_PRODUCT_SEARCH`、`TIKHUB_ENDPOINT_PRODUCT_DETAIL`、`TIKHUB_ENDPOINT_SELLER_PROFILE` 和 `TIKHUB_ENDPOINT_SHOP_ANALYTICS`。值必须是 `https://`，主机必须在 `TIKHUB_ALLOWED_HOSTS`（默认 `api.tikhub.io,tikhub.io`）中，且 URL 不得带 query token。
4. 确认各 endpoint 的认证方式；默认是 Bearer，也可使用 `TIKHUB_ENDPOINT_<KEY>_AUTH_MODE=api_key`。
5. 确认后设置 `TIKHUB_PILOT_ENABLED=true`，再显式入队：

   ```text
   python scripts/enqueue_collection_tasks.py --collector tikhub_pilot
   ```

Cookie 型 endpoint 默认禁止生产自动调用。只有在已完成供应商条款、账号合规和安全评审后，同时设置对应的 `..._PRODUCTION_AUTOMATION_ALLOWED=true`、`TIKHUB_ALLOW_COOKIE_ENDPOINTS=true`、对应的 `..._REQUIRES_COOKIE=true` 和 Worker Secret `TIKHUB_COOKIE_SECRET` 才能运行。Cookie 不接受命令行参数，也不会写入事件或日志。

## 数据边界

响应原始字节上传到私有 `private-raw-data` Storage，并在 `private_data_artifacts` 登记哈希、状态、请求参数哈希和 30 天保留期。`tikhub_fetch_events` 只保存 endpoint、参数哈希、时间、HTTP 状态、响应哈希、费用和私有 artifact ID。

标准化后只有稳定商品 ID、店铺 ID 或内容/视频 ID 才会进入对应实体和快照表。内容快照同时保存达人、关联商品/店铺、播放、点赞、评论、分享、转化和互动率字段。同一稳定 ID 使用来源、平台、市场生成同一 entity，按采集时间和响应证据生成追加 snapshot，因此可以跨天画价格、店铺和内容指标趋势。没有稳定 ID 的记录只计入缺失率，不写快照；重复稳定 ID 计入重复率。

TikHub 记录始终带 `source_kind=traceable`、`source_category=third_party_provider`、`verification_status=pending` 和 `publication_status=quarantined`。在授权确认前，字段映射中的 `commercial_authorized` 和 `public_display_allowed` 均为 `false`，不会进入 `formal_publications`、公开页面或公开导出。

## 离线验证

可以使用只包含试点四个 endpoint 键或内容四个 endpoint 键的 JSON fixture，不需要网络或密钥：

```text
python scripts/collect_tikhub_pilot.py --fixture ./local-tikhub-fixture.json --dry-run
# 内容快照离线校验
python scripts/collect_tikhub_pilot.py --content --fixture ./local-tikhub-content-fixture.json --dry-run
```

fixture 仅用于自动化测试，不能作为生产数据来源。Worker 只接受仓库内相对路径且拒绝 `..` 路径。

## 七天报告

每日运行写入 `tikhub_pilot_runs` 和 `tikhub_fetch_events`。七个不同 UTC 日期的运行完成后，使用 Worker Secret 执行：

```text
python scripts/collect_tikhub_pilot.py --report
```

报告写入私有 `tikhub_pilot_reports`，包括字段映射快照、缺失率、重复率、请求成功率、总请求数、估算费用、商品/店铺趋势计数、实际覆盖日期、市场/平台覆盖状态和授权摘要。没有真实运行七天前，不应对成功率、缺失率或费用作生产结论；`schema_only` 市场只能报告为待接入，不能报告为成功采集。

## 停止条件

出现授权撤回、来源过期、Cookie 合规不明、连续失败、每日请求/费用预算触顶或 endpoint 结构变化时，将 `TIKHUB_PILOT_ENABLED=false` 或暂停数据库任务。Worker 会继续记录失败和预算告警，但不会把失败结果发布到公开投影。
