# 永久历史数据模型

迁移 20260918000000_permanent_history.sql 在保留旧页面兼容表的前提下，建立追加式数据底座。

## 数据链路

1. source_fetch_runs 记录一次采集运行中每个来源的请求结果、耗时、记录数量和错误。
2. raw_source_records 保存不可变的原始证据。唯一键是 source_key + source_record_id + evidence_hash，相同证据重跑不会生成重复行。
3. policy_documents/policy_versions 和 platform_rules/platform_rule_versions 保存政策、费用、佣金、保证金、履约、禁售、结算、处罚等版本。版本触发器自动生成 previous_version_id、version_number 和 changed_fields。
4. product_entities、shop_entities、content_entities 保存平台稳定身份；对应的 snapshot 表按 collected_at 保存价格、GMV、粉丝、播放和转化等指标。
5. formal_publications 是经过来源授权和质量校验的可重建投影。它只保存来源允许展示的字段，浏览器和 AI 不直接读取原始层。

## 写入约定

scripts/sync_to_supabase.py 为每次采集复用一个 run_id，并使用和数据库相同的确定性 UUID。历史表使用 resolution=ignore-duplicates，禁止把重跑变成 UPDATE；实体主表才允许 upsert 更新 last_seen_at。

旧的 market_data_applicability 仍供现有页面读取，并增加 formal_publication_id 引用。删除或重建正式投影只会解除引用，不会删除原始证据、版本或快照。

## 查询入口

- platform_rule_change_history：查询规则新旧版本、上一版本和变化字段。
- product_price_trends：按商品和采集时间查询价格趋势。
- shop_metric_trends：按店铺和采集时间查询 GMV、粉丝和商品数。
- content_metric_trends：按内容和采集时间查询播放、互动和转化。

这些历史表和视图仅授予 service_role，公开页面使用 formal_publications 的来源白名单投影。
