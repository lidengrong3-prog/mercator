# 运维、监控与恢复手册

## 自动监控

`.github/workflows/operations.yml` 每 6 小时执行：

- 前端、数据和安全静态测试；
- 数据质量发布闸门；
- 正式 GitHub Pages 站点 HTTP 可用性检查。

任何步骤失败都会让 GitHub Actions 工作流失败，不会静默标记成功。

## 备份

Supabase 项目应优先启用平台提供的托管数据库备份和时间点恢复。仓库另提供手动加密逻辑备份：

1. GitHub Secrets 配置 `SUPABASE_DB_URL` 和高强度 `BACKUP_ENCRYPTION_KEY`。
2. 手动运行 `Operations and recovery`，勾选 `run_encrypted_backup`。
3. 工作流使用 `pg_dump` 生成 custom-format 备份，再以 AES-256-CBC/PBKDF2 加密。
4. GitHub Artifact 只保存加密文件和 SHA-256 校验文件，保留 7 天；未加密 dump 会在上传前删除。

恢复演练至少每季度执行一次。恢复时在隔离的测试 Supabase 项目中解密并使用 `pg_restore --clean --if-exists --no-owner`，完成账号隔离、RLS、报告和工作区抽样验证后，才能用于生产恢复。

## 管理后台

`admin-summary` Edge Function 只接受 `platform_admins` 表中登记的用户。它返回聚合统计、最近系统事件和备份运行，不把 service role key 暴露到浏览器。每次查看都会写入 `admin_audit_log`。

管理入口为 `#admin`。普通用户会收到服务端 `ADMIN_FORBIDDEN`，前端本身不能授予管理员权限。

## 事件处理

生产事故写入 `system_incidents`，状态依次为 `open → monitoring → resolved`。关键故障至少记录：开始时间、影响服务、严重级别、用户影响、修复过程和恢复时间。
