# 历史数据回填运行手册

步骤 9 的回填与每日采集分离运行。每个任务由 `history_backfill_jobs` 记录，每个日期窗口和分页由 `history_backfill_batches` 记录，成功请求的游标由 `history_backfill_checkpoints` 记录，来源覆盖范围和缺失区间由 `history_source_coverage` 记录。

## 运行前检查

1. 在 Supabase 生产项目执行迁移链，确认 `20260919000000_history_backfill.sql` 已成功执行。
2. 在服务端 Secrets 配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`。回填脚本不接受命令行明文密钥。
3. 在来源台账确认来源仍为 active、collection_enabled=true，且授权没有过期。
4. 先用 `--dry-run` 检查日期窗口、平台和批次数量。

## 命令示例

```text
python scripts/backfill_history.py --source federal-register --from 2020-01-01 --to 2020-12-31 --cadence year --dry-run
python scripts/backfill_history.py --source federal-register --from 2020-01-01 --to 2020-12-31 --cadence year
python scripts/backfill_history.py --source cpsc --from 2018-01-01 --to 2020-12-31 --batch-size 100
python scripts/backfill_history.py --source platform-rules --platform amazon --from 2020-01-01 --to 2026-09-18
python scripts/backfill_history.py --job-id <job-id> --resume
```

Federal Register 使用 `document_number` 作为稳定来源 ID，并保存 `publication_date`、分页页码和 `next_page_url`。CPSC 使用 `RecallNumber` 作为稳定来源 ID；同一召回内容变化时会写入新的证据哈希，不覆盖旧记录。Amazon、TikTok Shop 等平台规则只能回填规则目录实际提供的历史版本；没有可验证版本的窗口会进入 `missing_ranges`，不会用当前规则冒充历史规则。

## 批次与恢复语义

- 每个批次先做稳定 ID、证据哈希、日期范围和来源授权校验，校验通过后才写入永久历史和正式投影。
- 失败只把当前批次标为 `failed`，已完成批次不会重跑。
- `--resume` 按任务和批次唯一键恢复；已成功批次跳过，未完成批次继续使用其游标/页码。
- 重复执行不会重复写入 `raw_source_records`、版本或正式发布，因为这些写入使用来源 ID、证据哈希和确定性 UUID 去重。
- `history_source_coverage_overview` 可供管理后台展示来源、平台、覆盖起止日期、记录数和缺失区间。

## 上线限制

当前仓库只提供回填编排和 dry-run/单元测试，不会在 CI 中自动抓取多年数据。真正回填需要在生产环境完成迁移、配置服务端凭据并由运维人员按来源控制速率；回填前应先用一年或一个月窗口验证费用、速率和正式发布结果。
