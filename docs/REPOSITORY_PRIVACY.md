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

扫描所有可达提交的路径：

```bash
python scripts/history_privacy_scan.py --root . --output history-privacy-report.json
```

本次工作区扫描结果：历史路径 327 个，其中 79 个属于受限数据路径；当前可访问的历史对象没有检测到高置信度密钥。由于当前 checkout 是 Git partial clone，8 个密钥模式的旧 blob 不可本地读取，报告会明确标记 `secret_scan_complete=false`，不能把该结果当作完整历史无密钥证明。

因此暂不自动执行 `git filter-repo`、强推或密钥轮换。负责人需要在拿到完整 clone 后重新运行历史扫描；如发现真实密钥或受限用户数据：

1. 立即在对应供应商/Supabase/GitHub 中撤销并轮换密钥。
2. 由负责人书面授权后，使用 `git filter-repo` 清理所有分支和标签，并强制推送新的历史。
3. 再次运行当前分支检查、完整历史扫描和 Pages/Actions 产物抽查。
4. 用正式 `source_record_id` 关联私有 `raw_data_records`，不要把原文重新放回公开仓库。
