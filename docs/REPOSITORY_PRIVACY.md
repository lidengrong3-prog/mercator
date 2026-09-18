# 公共仓库隐私边界

## 允许提交的内容

公共 GitHub 只保存应用代码、Supabase 迁移、测试、数据契约、质量摘要和正式公开投影。Pages 由 `scripts/build_public_site.py` 的显式白名单组装，不会把工作区 `data/` 目录整体复制出去。

## 必须私有的内容

以下内容只能通过 service role 写入 Supabase 私有表或 `private-raw-data` bucket：

- API 原始响应、CPSC 原始召回、美国品类完整数据和 TikHub 付费数据；
- `collection_run` 完整账本、同步日志、隔离记录、quarantine 和基线数据；
- 数据库 dump、报告验收中间数据和任何包含用户/商品原文的诊断文件。

`data_source_access_policies` 为每个来源定义许可类别、访问等级、是否允许再分发、保留期限、条款链接和授权 Secret。TikHub 为商业来源，默认 `service_private`、禁止再分发、保留 30 天，密钥名为 `TIKHUB_API_KEY`。

## CI 防护

每次质量、数据更新、生产发布和运维工作流都会执行：

```bash
python scripts/repository_privacy_check.py
```

检查内容包括 Git 跟踪路径、常见高置信度密钥、超大原始 JSON/JSONL、正式公开记录的 `source_record_id`/`evidence_hash` 和 TikHub 公开泄漏。数据更新完成后会运行 `prepare_public_repository_data.py`，提交时只 `git add` 公开白名单文件。

Actions 只上传质量报告、健康检查和无内容诊断摘要。加密备份写入私有 Storage，仅上传对象哈希和路径摘要；`scripts/purge_private_data.py` 按来源保留期清理到期对象、原始记录和同步日志。

## 历史扫描与负责人操作

扫描所有可达提交的路径和内容：

```bash
python scripts/history_privacy_scan.py --root . --output history-privacy-report.json
```

发布或清理验收必须使用严格模式。它会在仓库不完整、blob 漏扫、pickaxe 扫描未完成、存在受限历史路径、密钥或扫描错误时失败：

```bash
python scripts/history_privacy_scan.py \
  --root . \
  --output history-privacy-report.json \
  --require-clean
```

扫描器会枚举所有分支和标签可达的 blob，使用批量对象读取执行高置信度密钥正则扫描，并用禁用 PDF textconv 的 pickaxe 扫描交叉检查。只有仓库既不是 shallow clone、也不是 partial clone，全部可达 blob 均已读取且没有扫描错误时，`secret_scan_complete` 才会为 `true`。

2026-09-15 使用全量 bare mirror 完成的扫描结果：471 个历史路径、2,746 个可达 blob 全部读取；发现 99 个受限历史路径，其中包括 68 个同步日志、14 个原始/隔离/运行/基线文件、8 个美国品类数据文件和 9 个旧 PDF。8 类高置信度密钥模式未命中，扫描错误为 0。当前公共 `main` 已不再跟踪这些文件，但旧提交中的对象仍可通过提交哈希读取。

历史改写会更改所有相关提交哈希，并要求所有协作者重新克隆。2026-09-18 的授权清理记录、99 条路径分类、备份校验、分支哈希和 GitHub Pull Request 引用残留见 `docs/HISTORY_CLEANUP_2026-09-18.md` 与 `docs/history_cleanup_inventory_2026-09-18.json`。如负责人再次授权清理历史：

1. 立即在对应供应商/Supabase/GitHub 中撤销并轮换密钥。
2. 由负责人书面授权后，使用 `git filter-repo` 清理所有分支和标签，并强制推送新的历史。
3. 再次运行当前分支检查、完整历史扫描和 Pages/Actions 产物抽查。
4. 用正式 `source_record_id` 关联私有 `raw_data_records`，不要把原文重新放回公开仓库。
