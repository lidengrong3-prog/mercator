# 工作区与团队权限

工作区基础与协作迁移：

`supabase/migrations/20260826010000_workspaces.sql`

`supabase/migrations/20260909010000_workspace_collaboration.sql`

## 已实现

- `workspaces`：工作区名称、所有者和审计时间。
- `workspace_members`：所有者、管理员、编辑者、查看者四级角色，以及停用状态。
- `workspace_invites`：邀请邮箱、角色、7 天有效期、接受状态，以及邮件供应商、发送状态、消息 ID 和失败原因。
- 新用户自动创建“我的工作区”，现有用户通过迁移补齐默认工作区。
- RLS：只有工作区成员可以读取工作区和成员；只有所有者/管理员可以管理成员和邀请。
- 所有者保护：不能被降级或删除，暂未开放所有权转移。
- `accept_workspace_invite(invite_id)` RPC：仅允许与邀请邮箱一致的登录用户接受邀请。
- `generated_reports`、`report_materials`、`user_watchlist`、`saved_workspace_items` 都以 `workspace_id` 作为共享和隔离边界，`user_id` 只保留原创建者审计用途。
- 所有者、管理员和编辑者可以维护共享业务数据；查看者只读；不同工作区无法互相读取。
- 设置页“团队与权限”：切换工作区、查看成员、发送/撤回邀请、查看真实投递状态、修改成员角色和状态、修改工作区名称。
- `workspace-invite` 通过 Resend 发送真实邀请邮件。未配置邮件服务或供应商拒绝时返回失败，页面不会显示“已发送”。

## 部署顺序

1. 按文件名顺序执行全部 Supabase migrations，确认 `20260909010000_workspace_collaboration.sql` 已应用。
2. 用一个已注册账号进入“设置与权限 → 团队与权限”，确认自动生成默认工作区。
3. 配置 `RESEND_API_KEY`、`APP_PUBLIC_URL` 和已在 Resend 验证的 `WORKSPACE_INVITE_FROM_EMAIL`。
4. 部署 JWT 保护的 `workspace-invite`，发送邀请并确认页面显示“已发送”，收件人可从邮件链接登录并加入对应工作区。
5. 分别以编辑者和查看者验证共享数据；退出或停用成员后再次读取必须失败。

通知基础设施位于 `supabase/migrations/20260826020000_notifications.sql` 和 `supabase/migrations/20260908000000_notification_channels.sql`。`notification_events` 记录站内事件，`notification_deliveries` 记录邮件、企业微信和飞书的真实投递、重试与供应商结果。每个用户在每个工作区独立配置渠道；企业 Webhook 仅由 `notification-dispatch` 加密保存，浏览器只能读取脱敏目标。定时任务按用户保存的市场、平台、品类和事件类型范围生成通知，并以来源记录 ID 去重。普通浏览器请求创建的事件只保留站内投递；只有服务端生成的已核验预警和受控测试事件可以进入外部队列。

外部渠道默认关闭。生产环境必须配置 `NOTIFICATION_CONFIG_ENCRYPTION_KEY`、`RESEND_API_KEY` 和已验证的 `NOTIFICATION_FROM_EMAIL`，完成三类渠道的真实测试后才能把 `NOTIFICATION_CHANNELS_ENABLED` 设为 `true`。`.github/workflows/notification-delivery.yml` 每五分钟原子认领待发送任务，超时任务会恢复，单条最多尝试五次。

报告保存与导出基础设施位于 `supabase/migrations/20260826030000_report_exports.sql`、`supabase/migrations/20260908010000_report_server_validation.sql` 和 `supabase/functions/report-save`、`report-export`、`report-docx`。`report-save` 使用用户 JWT 验证身份，以服务端数据重新复核质量、范围、覆盖和引用后才写入正式报告；导出函数再次复核并以服务端密钥写入私有 `reports` Storage bucket，返回 1 小时有效的签名 URL；服务端不可用时前端才会明确降级为本地打印。

生产发布和真实邮件发送仍依赖生产 Supabase 已应用迁移、有效的 Resend Key 与已验证发件人；仓库内不保存这些凭证。
