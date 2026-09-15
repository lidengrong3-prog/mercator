# 数据底座与来源体系

## 两套口径

系统保留两套有意不同的记录口径：

- `raw_data_records`：采集到的原始证据包。包含待核验、拒绝、演示和超出当前市场范围的记录，用于审计、去重和重新处理。
- `market_data_applicability`：正式发布投影。只包含当前目录范围内、来源完整且 `verification_status` 为 `verified` 或 `uploaded` 的记录。

浏览器匿名读路径只读取正式投影。原始证据表默认没有匿名读取策略，服务端同步任务使用 service role 写入。

## GitHub Pages 发布边界

公开仓库中的 `data/` 只允许保存正式公开投影和数据契约，不再充当原始采集工作区。生产发布只允许 `scripts/build_public_site.py` 组装 Pages 产物，禁止复制整个 `data/`。公开白名单固定为市场范围与质量摘要、当前范围国家/平台目录、政策/规则/预警/税收/准入正式投影，以及美国宏观指标，共 10 个 JSON 文件。

构建器对事实记录复用 `record_quality()` 的当前范围、来源完整性、许可策略和 `verified/uploaded` 判定；`pending`、`rejected`、`demo`、第三方行业资讯、禁止再分发的数据和范围外记录不会进入静态兜底或 Supabase 公共 `market_data` bundle。`data/_sync_logs/`、`quarantine_*`、`*_baseline.json`、采集临时文件、CPSC 原始召回和美国品类源文件均被 `.gitignore` 与 CI 拦截，采集后写入私有 Storage/数据库。每个 Pages 产物生成 `public-data-manifest.json` 记录精确文件清单和过滤数量。

原始证据仍由 service role 写入 `raw_data_records`，大文件写入私有 `private-raw-data` bucket，并由 `private_data_artifacts` 保存哈希、对象路径和保留期限。`market_data_applicability.raw_record_id` 由数据库触发器关联原始证据；浏览器可看到来源 ID，但没有读取原始表或私有对象的权限。

## 第三方授权和保留

`data_source_access_policies` 是 service-only 表，逐来源保存许可类别、访问等级、商业使用与再分发权限、授权状态和有效期、API 价格、速率限制、保留天数、存储/展示/导出字段白名单、条款地址和所需 Secret 名称。TikHub 固定为 `commercial/service_private`，默认授权状态为 `pending`，原始响应保留 30 天，`redistribution_allowed=false`，密钥只能通过 `TIKHUB_API_KEY` Secret 注入。即使记录通过内容核验，授权未确认或许可策略不允许再分发时也不能进入 GitHub、Pages、公共 `market_data` 或 AI 报告。完整台账流程见 [SOURCE_GOVERNANCE.md](SOURCE_GOVERNANCE.md)。

`scripts/purge_private_data.py` 由运维工作流定时执行：先通过 Storage API 删除到期对象，再删除对象登记、到期原始记录和超过 90 天的同步日志。GitHub Actions 只上传不含内容的删除结果摘要。

## 来源协议

每条正式记录应带有 `data/provenance_schema.json` 中定义的字段：

`source_kind`、`source_type`、`source_url`、`source_record_id`、`collected_at`、`retrieved_at`、`published_at`、`effective_from`、`effective_to`、`verified_at`、`verification_status`、`verification_notes` 和 `evidence_hash`。

`source_kind` 只允许以下值：

- `official`：政府、监管机构等官方来源。
- `traceable`：可定位到原始记录的第三方或平台来源。
- `uploaded`：人工上传并经过上传审核的数据。
- `derived`：由正式记录计算或聚合得到的数据。
- `demo`：演示数据，只能保留在原始层，不能进入正式统计。

未知来源或无法定位到具体记录的采集结果必须保持 `pending`，不能通过前端过滤器或同步器进入正式投影。

## 第三方行业资讯

雨果网、AMZ123 等行业媒体属于 `source_kind=traceable`、`source_type=licensed_provider`，记录使用 `source_class=industry_advisory` 标记。采集器会根据标题和摘要识别明确提到的市场，无法识别市场的全球文章只保留在原始证据层。

这类文章必须保留具体文章链接、发布日期、采集时间和中文展示字段，前端以“可追溯参考 · 非官方核验”单独展示。它们不会进入官方政策统计、正式报告、市场适用性投影或自动高风险预警；只有经过独立的记录级复核，才可以由人工决定是否转为正式来源。

## 日常流程

1. 采集器从 `data/market_scope.json` 读取 `data_status=configured` 的市场和市场平台关系；`schema_only` 市场不会触发网络采集，也不会复用其他市场的数据。
2. 所有查询参数通过 UTF-8 URL 编码后发出。采集器把事实写入统一记录及证据哈希；无法确认具体记录时写入 `pending`，不再把搜索标题回写到旧国家或平台 JSON 字段。
3. 每次运行生成 `data/collection_run.json`（schema v2），逐来源记录适用市场/平台、请求成功数、失败数、耗时、采集记录数和当前范围记录数。政策/规则、美国品类、CPSC、FRED/BLS 四个采集器在独立进程中追加到同一份账本，不会相互覆盖；账本的总状态和 summary 必须与来源明细一致。
4. `python scripts/validate_data.py` 生成 `data/quality_report.json`，同时写入本轮账本版本、状态、完成时间、范围、流水线来源和缺失来源。已配置市场但没有本轮账本、账本不完整或核心来源失败时，质量闸门直接失败；非核心来源失败显示降级。
5. 只有质量闸门为 `healthy` 或 `degraded` 时，才允许运行 `python scripts/sync_to_supabase.py`。
6. 同步器先写来源授权、`raw_data_records` 和私有 Storage 对象，再写正式适用性投影和经过同一正式记录过滤的公开数据包；同步运行明细只写 `private_sync_runs`。
7. `prepare_public_repository_data.py` 把混合采集输出压缩成允许提交的正式投影，`repository_privacy_check.py` 在提交和发布前阻断受限路径、密钥、高风险大型响应和缺失来源 ID 的正式记录。
8. Pages 构建器按白名单生成静态兜底；生产 smoke 同时验证公开文件可读和代表性私有路径返回 404。
9. 新市场、平台或品类先登记到 `data/market_scope.json`，同步器会按清单动态展开组合，不应在代码中新增硬编码分支。

公开 Git checkout 不包含采集账本、CPSC 原始记录和美国品类源文件，因此 CI、代码部署与运维巡检使用 `python scripts/validate_data.py --public-projection`。该模式只读既有 `data/quality_report.json`，要求其发布闸门已通过，并核对公开投影的结构、当前范围、HTTPS 来源、显式 provenance、重复 ID 和 `formal_records` 数量；未指定 `--report` 时不会覆盖 Worker 生成的质量报告。完整的 `python scripts/validate_data.py` 和 `sync_to_supabase.py` 只由持有私有采集输入的独立 Worker 执行。

美国品类采集文件同时记录四个不同语义的字段：`content_updated_at` 是事实内容发生变化的时间，`last_attempted_at` 是最近一次采集尝试，`last_checked_at` 只在该品类全部 Federal Register 查询成功时推进，`collection_status` 为 `succeeded`、`degraded`、`failed` 或 `skipped`。网络失败复用缓存时，原 `generated_at`、`as_of` 和记录级采集时间保持不变；质量闸门以八个品类中最早的完整成功检查时间判断总体新鲜度。`failed` 和 `skipped` 都阻断发布，只有部分请求成功的 `degraded` 可带明确告警继续进入后续流程。

## 历史记录

旧 JSON 记录可能暂时依赖兼容性推断。质量报告会单独统计 `legacy_inferred_records`，这不等于人工核验。历史记录需要重新抓取或完成记录级复核后，才应补齐显式 `verified_at` 和核验说明；不能为了让质量状态变绿而修改时间或来源。

平台规则记录可额外提供 `rule_key`、`rule_version`、`effective_date`、`effective_to`、`change_summary` 和 `version_history`。平台规则页固定展示费用、佣金、保证金、履约、禁售、结算和处罚七个维度；来源没有提供的维度显示“尚未接入”，不会从其他平台或全球记录推断。同步到 `market_data_applicability` 时，显式版本写入 `record_version` 并使用独立记录键，从而保留同一市场和平台的历史版本。

## 动态预警的记录级来源

预警是由已采集的政策或 CPSC 原始记录派生的正式数据，不是独立事实来源。每条正式预警必须保留 `source_record_id`、具体 `source_url`、`published_at`、`collected_at`、`verified_at`、`verification_status`、`verification_notes` 和 64 位 `evidence_hash`，并使用当前 `generator_version`。聚合预警还会记录参与计算的 `source_record_ids`，以便逐条回溯。

只有上游记录已完成记录级核验时，派生预警才会标记为 `verified` 并进入正式列表。缺少采集时间、核验时间、来源 URL、证据哈希或仍为 `pending` 的记录会被生成器丢弃；合并旧数据时不会用当前时间补写历史时间，也不会继续保留旧生成器版本的记录。被丢弃的记录只能通过重新采集或人工复核恢复。

## 迁移部署顺序

数据库从 `supabase/migrations/20260824000000_database_foundation.sql` 开始，严格按文件名执行整个目录。基础迁移包含原 `schema.sql`、`phase2_schema.sql`、`monitored_shops.sql` 和 `add_indexes.sql` 所需的根表、认证触发器、RLS 与索引；这些目录外 SQL 仅保留为历史快照，不再是部署前置步骤。

`python scripts/validate_migration_chain.py` 会检查旧基础对象覆盖率和逐文件表依赖顺序，生产 `release_preflight.py` 会执行同一检查。具备 Docker 的本地环境还必须运行 `npx supabase db reset`，证明空库只依赖迁移目录即可重建。正式环境统一使用 `supabase db push --linked --include-all`，以便存量项目补记较早版本的幂等基础迁移。

迁移只创建底座和元数据，不会把演示数据或未经核验的数据变成正式事实。市场目录、来源体系、平台规则版本、第三方资讯分类和报告素材快照均由基础迁移之后的有序迁移继续演进。

商品、店铺和内容素材在加入报告时保留 `snapshot_data` 原始记录，以及市场、平台、品类、来源和快照时间字段；快照表示加入报告当时的记录，不代表当前数据会被回写成历史事实。
