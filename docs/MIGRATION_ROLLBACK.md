# 生产迁移前备份与回滚手册

生产发布在 `db push` 前必须完成 `migration-backup` Job。也可以先手动运行
`.github/workflows/pre-migration-backup.yml`，只创建备份而不发布代码或执行迁移。
该 Job 读取当前
`supabase_migrations.schema_migrations`，记录迁移前版本，使用 PostgreSQL
custom-format `pg_dump` 创建逻辑备份，并完成以下校验：

- `pg_restore --list` 能读取归档且包含迁移账本；
- AES-256-CBC/PBKDF2 加密后可以解密，解密归档的条目数和迁移账本一致；
- 私有 Storage 中的对象 SHA-256 和字节数与本地加密文件一致；
- `backup_runs` 中存在本次完成或失败记录；
- 发布摘要保存备份对象位置、迁移前版本、目标版本、校验和和回滚锚点。

## 发布前阻断

只要备份配置缺失、`pg_dump` 失败、归档解析失败、加密往返失败、上传失败或
`backup_runs` 留痕失败，`deploy-backend` 不会执行生产迁移。已有应用版本继续运行。

## 迁移失败时

1. 停止当前发布，不重试会继续改变数据库的步骤。
2. 保存 `migration-backup-result.json` 中的 `pre_migration_head`、备份对象 ID、
   SHA-256 和 `backup_run_id`。
3. 在隔离数据库运行月度恢复演练流程，验证解密、`pg_restore`、RLS、工作区、报告
   和来源数据抽样；不要直接在生产库执行 `--clean`。
4. 首选 Supabase 的时间点恢复（PITR）恢复到迁移前时间点。若无可用 PITR，先将
   加密备份恢复到新的数据库，再切换受控的连接配置；生产原库保留为取证副本。
5. 恢复后确认迁移账本等于记录的 `pre_migration_head`，再运行生产健康检查和双账号
   验收。确认通过后才重新发布修复版本。

迁移文件没有自动生成的 down migration，因此系统不会在生产失败后猜测反向 SQL。
回滚依赖“迁移前备份 + PITR 或替换数据库”的可审计流程。备份密钥只存在于 GitHub
Production Environment Secrets，不能写入仓库、Artifact 明文或日志。
