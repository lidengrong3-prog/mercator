# 数据底座与来源体系

## 两套口径

系统保留两套有意不同的记录口径：

- `raw_data_records`：采集到的原始证据包。包含待核验、拒绝、演示和超出当前市场范围的记录，用于审计、去重和重新处理。
- `market_data_applicability`：正式发布投影。只包含当前目录范围内、来源完整且 `verification_status` 为 `verified` 或 `uploaded` 的记录。

浏览器匿名读路径只读取正式投影。原始证据表默认没有匿名读取策略，服务端同步任务使用 service role 写入。

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

1. 采集器写入记录级来源和证据哈希；无法确认具体记录时写入 `pending`。
2. `python scripts/validate_data.py` 生成 `data/quality_report.json`，检查结构、范围、新鲜度和来源质量。
3. 只有质量闸门为 `healthy` 或 `degraded` 时，才允许运行 `python scripts/sync_to_supabase.py`。
4. 同步器先写 `data_source_registry` 和 `raw_data_records`，再写正式适用性投影和公开数据包。
5. 新市场、平台或品类先登记到 `data/market_scope.json`，同步器会按清单动态展开组合，不应在代码中新增硬编码分支。

## 历史记录

旧 JSON 记录可能暂时依赖兼容性推断。质量报告会单独统计 `legacy_inferred_records`，这不等于人工核验。历史记录需要重新抓取或完成记录级复核后，才应补齐显式 `verified_at` 和核验说明；不能为了让质量状态变绿而修改时间或来源。

平台规则记录可额外提供 `rule_key`、`rule_version`、`effective_date`、`effective_to`、`change_summary` 和 `version_history`。平台规则页固定展示费用、佣金、保证金、履约、禁售、结算和处罚七个维度；来源没有提供的维度显示“尚未接入”，不会从其他平台或全球记录推断。同步到 `market_data_applicability` 时，显式版本写入 `record_version` 并使用独立记录键，从而保留同一市场和平台的历史版本。

## 迁移部署顺序

按时间顺序执行：

1. `supabase/migrations/20260830000000_market_catalog.sql`
2. `supabase/migrations/20260830010000_data_provenance.sql`
3. `supabase/migrations/20260831000000_platform_rule_versions.sql`

迁移只创建底座和元数据，不会把演示数据或未经核验的数据变成正式事实。

第三方行业资讯分类迁移：

4. `supabase/migrations/20260831020000_industry_advisory.sql`

报告素材快照字段迁移：

5. `supabase/migrations/20260831030000_report_material_snapshots.sql`

商品、店铺和内容素材在加入报告时保留 `snapshot_data` 原始记录，以及市场、平台、品类、来源和快照时间字段；快照表示加入报告当时的记录，不代表当前数据会被回写成历史事实。
