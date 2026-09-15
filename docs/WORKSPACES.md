# 工作区与团队权限

工作区基础与协作迁移：

`supabase/migrations/20260826010000_workspaces.sql`

`supabase/migrations/20260909010000_workspace_collaboration.sql`

`supabase/migrations/20260913000000_workspace_report_exports.sql`

`supabase/migrations/20260914000000_workspace_billing.sql`

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
- 角色与套餐分离：工作区套餐决定可用功能额度，成员角色只决定查看、编辑和成员管理权限。
- `workspace_subscriptions`：每个工作区一条套餐记录，支持 Stripe 和可审计的内测人工配置；席位、AI Token、报告和导出额度均属于工作区。
- `workspace_usage_monthly`：按工作区和月份原子计数；AI 预占、报告生成和 PDF/DOCX 导出在并发请求下不会突破额度。
- `workspace_member_usage_minute`：按工作区、成员和分钟窗口原子计数，保留单成员限流；失败供应商请求也计入当前窗口，旧窗口自动清理。
- 工作区席位默认免费版 1、Pro 5、企业版 50；有效邀请和 active 成员共同占用席位，超限返回 `WORKSPACE_SEAT_LIMIT_REACHED`。
- 报告列表显示创建人、所属工作区和当前账号可执行操作；报告导出记录按 `workspace_id` 共享，导出者仍保留在 `user_id` 中用于审计。
- 查看者可以打开工作区内允许共享的报告，但不能添加素材、生成/保存报告、创建导出记录或管理成员。
- 登录、刷新、重新登录、切换工作区和令牌续期都会重新读取成员关系；成员被移除或停用后，下一次刷新会清空本地工作区缓存并阻断访问。
- 设置页“团队与权限”：切换工作区、查看成员、发送/撤回邀请、查看真实投递状态、修改成员角色和状态、修改工作区名称。
- `workspace-invite` 通过 Resend 发送真实邀请邮件。未配置邮件服务或供应商拒绝时返回失败，页面不会显示“已发送”。

## 部署顺序

1. 按文件名顺序执行全部 Supabase migrations，确认 `20260909010000_workspace_collaboration.sql`、`20260913000000_workspace_report_exports.sql` 和 `20260914000000_workspace_billing.sql` 已应用；后两者会回填历史导出/运行/AI 记录的 `workspace_id`，并启用共享额度和角色策略。
2. 用一个已注册账号进入“设置与权限 → 团队与权限”，确认自动生成默认工作区。
3. 配置 `RESEND_API_KEY`、`APP_PUBLIC_URL` 和已在 Resend 验证的 `WORKSPACE_INVITE_FROM_EMAIL`。
4. 部署 JWT 保护的 `workspace-invite`，发送邀请并确认页面显示“已发送”，收件人可从邮件链接登录并加入对应工作区。
5. 分别以编辑者和查看者验证共享数据；退出或停用成员后再次读取必须失败。
6. 在“套餐与账单”确认当前工作区的套餐、AI Token、报告、导出和席位用量；切换到免费工作区后这些数据必须独立显示。

通知基础设施位于 `supabase/migrations/20260826020000_notifications.sql` 和 `supabase/migrations/20260908000000_notification_channels.sql`。`notification_events` 记录站内事件，`notification_deliveries` 记录邮件、企业微信和飞书的真实投递、重试与供应商结果。每个用户在每个工作区独立配置渠道；企业 Webhook 仅由 `notification-dispatch` 加密保存，浏览器只能读取脱敏目标。定时任务按用户保存的市场、平台、品类和事件类型范围生成通知，并以来源记录 ID 去重。普通浏览器请求创建的事件只保留站内投递；只有服务端生成的已核验预警和受控测试事件可以进入外部队列。

外部渠道默认关闭。生产环境必须配置 `NOTIFICATION_CONFIG_ENCRYPTION_KEY`、`RESEND_API_KEY` 和已验证的 `NOTIFICATION_FROM_EMAIL`，完成三类渠道的真实测试后才能把 `NOTIFICATION_CHANNELS_ENABLED` 设为 `true`。`.github/workflows/notification-delivery.yml` 每五分钟原子认领待发送任务，超时任务会恢复，单条最多尝试五次。

报告保存与导出基础设施位于 `supabase/migrations/20260826030000_report_exports.sql`、`supabase/migrations/20260908010000_report_server_validation.sql` 和 `supabase/functions/report-save`、`report-export`、`report-docx`。`report-save` 使用用户 JWT 验证身份，以服务端数据重新复核质量、范围、覆盖和引用后才写入正式报告；导出函数再次复核并以服务端密钥写入私有 `reports` Storage bucket，返回 1 小时有效的签名 URL；服务端不可用时前端才会明确降级为本地打印。

生产发布和真实邮件发送仍依赖生产 Supabase 已应用迁移、有效的 Resend Key 与已验证发件人；仓库内不保存这些凭证。
