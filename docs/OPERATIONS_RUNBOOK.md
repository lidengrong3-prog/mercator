# 运维、监控与恢复手册

## 自动监控

`.github/workflows/operations.yml` 每 6 小时执行：

- `code-health`：前端语法、安全、Python 和 Node 自动化测试；
- `data-quality`：独立执行数据质量发布闸门，并保存本次运行专用的 `operations-data-quality-result.json`；
- `availability-monitor`：独立检查正式 GitHub Pages、发布清单、数据库、`reports` Storage、所有 Edge Functions 和真实账号认证。

三个任务互不依赖并行运行。代码或数据质量失败不会阻止生产可用性探针，生产组件失败也不会吞掉数据质量结果。任何失败仍会让整个 GitHub Actions 工作流显示失败，不会静默标记成功。

`availability-monitor` 会始终执行全部组件探针；单个数据库表或 Edge Function 请求异常时，也会继续检查其余目标。定时监控从生产站点的 `release.json` 读取实际部署 SHA，再与 Edge Function 返回的 `X-JAY-Release` 比较，不使用当前 `main` 的检出 SHA 代替生产版本。发布工作流仍可通过显式 `EXPECTED_RELEASE_SHA` 严格验证刚发布的提交。结果写入 `production-health-result.json`，包含总状态、失败组件、逐组件耗时、HTTP 状态和发布 SHA，并作为 `production-health-<run_id>` Artifact 保留 30 天。数据质量结果使用独立的 `operations-data-quality-<run_id>` Artifact，不能用“网站可访问”代替“数据可发布”，也不能用“数据质量失败”推断生产服务宕机。

手动运行 `Production readiness and staged rollout` 的 `config-audit` 操作，会先把收费、
收费验收、通知和通知验收四个开关显式保持为 `false`，再验证严格正式 origin、两套
验收账号登录与隔离、以及 Billing/通知运行时状态。公开收费或通知正式验收前，不得
修改这些关闭值。

## 备份

Supabase 项目应优先启用平台提供的托管数据库备份和时间点恢复。仓库另提供手动加密逻辑备份：

1. GitHub Secrets 配置 `SUPABASE_DB_URL` 和高强度 `BACKUP_ENCRYPTION_KEY`。
2. 手动运行 `Operations and recovery`，勾选 `run_encrypted_backup`。
3. 工作流使用 `pg_dump` 生成 custom-format 备份，再以 AES-256-CBC/PBKDF2 加密。
4. GitHub Artifact 只保存加密文件和 SHA-256 校验文件，保留 7 天；未加密 dump 会在上传前删除。

恢复演练至少每季度执行一次。恢复时在隔离的测试 Supabase 项目中解密并使用 `pg_restore --clean --if-exists --no-owner`，完成账号隔离、RLS、报告和工作区抽样验证后，才能用于生产恢复。

生产发布还会在 `db push` 前运行 `migration-backup` 闸门。它会记录迁移前版本，
验证 custom-format 归档和 AES-256-CBC/PBKDF2 加密往返，将加密文件写入私有
`private-raw-data`，并登记 `backup_runs`。备份失败时生产迁移不会开始。迁移没有
自动 down migration；失败时按 [生产迁移前备份与回滚手册](MIGRATION_ROLLBACK.md)
使用 PITR 或隔离恢复后的替换数据库方案。

## 管理后台

`admin-summary` Edge Function 只接受 `platform_admins` 表中登记的用户。它返回聚合统计、最近系统事件和备份运行，不把 service role key 暴露到浏览器。每次查看都会写入 `admin_audit_log`。

管理入口为 `#admin`。普通用户会收到服务端 `ADMIN_FORBIDDEN`，前端本身不能授予管理员权限。

## 事件处理

生产事故写入 `system_incidents`，状态依次为 `open → monitoring → resolved`。关键故障至少记录：开始时间、影响服务、严重级别、用户影响、修复过程和恢复时间。
