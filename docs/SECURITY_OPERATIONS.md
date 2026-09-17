# 公众服务安全与运维基线

第六步的代码和迁移把可自动化的安全边界纳入仓库；生产项目仍需要在 Supabase、GitHub 和域名 DNS 控制台完成一次配置。

## 域名、HTTPS 和 CORS

1. 在 Pages 或正式托管平台绑定自定义域名，等待 DNS 验证和 HTTPS 证书签发。
2. `PRODUCTION_SITE_URL` 填完整的 `https://` 页面地址；`ALLOWED_ORIGINS` 只填该地址的 origin（协议加域名，不带路径、不带逗号、不填 `*`）。发布前 `scripts/release_preflight.py --origin-only` 会拒绝其他值。
3. 把同一 origin 配置到 Supabase Auth 的 Site URL 和 Redirect URLs；本地 origin 只允许在开发环境的 Edge Function Secret 中使用。
4. 浏览器只调用 JWT 保护的函数。函数统一返回 `Vary: Origin`，非法 origin 返回 `403 ORIGIN_NOT_ALLOWED`，服务端密钥不进入前端。

## 限流和告警

`20260916000000_security_operations.sql` 创建了原子限流 RPC。`_shared/security.ts` 对 AI、报告保存、PDF/DOCX、邀请、计费、搜索、上传和数据权利接口同时按用户和 IP 计数，超过窗口返回 `429` 与 `Retry-After`。`security-gate` 是搜索和云端上传的前置检查。默认窗口可以通过 `RATE_LIMIT_<SCOPE>_USER_PER_WINDOW`、`RATE_LIMIT_<SCOPE>_IP_PER_WINDOW` 和 `RATE_LIMIT_<SCOPE>_WINDOW_SECONDS` 调整。

登录和密码重置由 Supabase Auth 的内建保护负责，生产控制台还要把 Auth 的 email/password、OTP 和 password recovery 频率限制设为组织能承受的值。搜索和上传若由前端直接读写 Storage/表，应通过同样的 RPC 或后端代理接入，不得依赖按钮禁用。

资源和课程上传会在 Storage 写入前把文件名、大小、MIME 与前 64 字节交给 `security-gate`，拒绝超限文件、可执行/活动内容、危险双扩展名和签名伪装；`resource-library` 注册文件时再次核对格式、MIME、大小和路径。生产仍需对私有上传隔离区接入恶意软件扫描，扫描通过后才进入正式可下载路径。

运维工作流每 6 小时写入健康快照，并把 5xx、AI 失败率、数据库/Storage 容量、采集失败、备份年龄和恢复演练年龄转成 `system_incidents`。管理员后台会显示最近健康快照、限流事件和恢复演练结果。

## 备份和恢复

- `.github/workflows/encrypted-backup.yml` 每日生成加密 PostgreSQL logical dump，并将 `private-raw-data`、`reports` Storage 对象分页列出、逐对象流式下载、记录 SHA-256 后打包加密。历史 `encrypted_backup` 和 `storage_backup` 对象不会再次进入 Storage 归档，避免备份递归膨胀。
- Storage 归档加密后必须立即解密到临时文件，通过字节比较和 `tar` 目录校验后才能上传。数据库备份与 Storage 备份分别写入 `backup_runs`；Actions Artifact 只保留不含数据正文和密钥的摘要。
- `.github/workflows/restore-drill.yml` 每月第一天将最新数据库备份恢复到独立的 `RESTORE_DRILL_DB_URL`，验证迁移账本、关键表 RLS、用户、工作区、报告、导出和来源表，并逐对象校验最新 Storage 归档的大小与 SHA-256，最后写入 `backup_restore_drills`。
- GitHub `production` Environment 必须配置 Secret `RESTORE_DRILL_DB_URL`，以及 Variable `RESTORE_DRILL_CONFIRM_ISOLATED=true`。工作流同时读取生产 `SUPABASE_DB_URL` 并比较数据库 endpoint 和 Supabase project ref；两者相同或未明确确认时会在恢复前失败。
- `STORAGE_BACKUP_BUCKETS` 默认是 `private-raw-data,reports`，`STORAGE_BACKUP_MAX_BYTES` 默认是 `500000000`。容量上限应根据生产 Storage 用量调整，但不能通过删除上限来掩盖异常增长。
- Supabase 项目本身的托管备份、PITR 和 Storage 生命周期仍要在控制台打开；仓库内备份是第二层恢复路径，不替代供应商托管备份。

### 生产验收顺序

1. 先应用最新迁移，确认 `service_role` 可以登记 `backup_runs` 和 `backup_restore_drills`。
2. 手动运行 `Encrypted private backups` 两次；两次均须完成数据库 dump、Storage 归档、加密往返验证、私有上传和登记，并确认第二次归档摘要中的 `excluded_backup_objects` 大于等于第一次产生的备份对象数。
3. 在 `backup_runs` 中确认两轮 logical 与 storage 记录均为 `completed`，位置、大小和校验和不为空。
4. 手动运行 `Monthly isolated restore drill`，确认摘要中的 `database_restored`、`migration_ledger_valid`、`rls_enabled`、`storage_backup_integrity` 和 `storage_archive_verified` 全部为 `true`。
5. 在 `backup_restore_drills` 中确认本次结果为 `passed`；任何一步失败都不能把恢复能力标记为已验收。

## 数据导出和删除

`data-subject-request` 提供 `export`、`delete_account`、`delete_workspace` 和 `GET` 状态查询。账号导出只读取当前用户允许的数据并直接下载 JSON；账号删除会清理用户表、报告 Storage 和 Auth 用户，若用户仍拥有工作区则先要求完成所有权转移。工作区删除仅允许 owner/admin，并依赖数据库外键级联清理报告、素材、导出和成员记录。

## 上线验收

- 使用真实正式域名从两台设备登录，确认合法 origin 成功、陌生 origin 返回 403。
- 用同一用户/IP 连续发送超过限额的 AI、报告、导出和邀请请求，确认 429、`Retry-After` 和限流事件均出现。
- 在隔离数据库执行一次手动恢复演练，确认生产数据库和 Storage 没有被写入。
- 申请一次账号导出并核对不含私有第三方原始响应；使用专用测试工作区申请删除，再确认成员和 Storage 访问立即失效。
- 在管理员后台核对服务状态、最近失败原因、AI 成本、容量、备份年龄和最近恢复演练状态。
- 按 [STAGED_PUBLIC_ROLLOUT.md](STAGED_PUBLIC_ROLLOUT.md) 依次完成 100/500/1000 并发、成本容量和 14 天稳定窗口；1000 并发不得由定时任务自动运行。
