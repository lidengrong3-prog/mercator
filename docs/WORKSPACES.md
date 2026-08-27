# 工作区与团队权限

第三阶段新增迁移文件：

`supabase/migrations/20260826010000_workspaces.sql`

## 已实现

- `workspaces`：工作区名称、所有者和审计时间。
- `workspace_members`：所有者、管理员、编辑者、查看者四级角色，以及停用状态。
- `workspace_invites`：邀请邮箱、角色、7 天有效期、接受/过期/撤回状态。
- 新用户自动创建“我的工作区”，现有用户通过迁移补齐默认工作区。
- RLS：只有工作区成员可以读取工作区和成员；只有所有者/管理员可以管理成员和邀请。
- 所有者保护：不能被降级或删除，暂未开放所有权转移。
- `accept_workspace_invite(invite_id)` RPC：仅允许与邀请邮箱一致的登录用户接受邀请。
- 设置页“团队与权限”：查看成员、创建/撤回邀请、修改成员角色和状态、修改工作区名称。

## 部署顺序

1. 在 Supabase SQL Editor 中按顺序执行 `20260825000000_unify_user_data.sql` 和 `20260826010000_workspaces.sql`。
2. 用一个已注册账号进入“设置与权限 → 团队与权限”，确认自动生成默认工作区。
3. 创建一条邀请记录。当前仓库没有邮件投递服务，因此页面会明确显示“邀请记录已创建；邮件尚未发送”。
4. 配置邮件服务或 Edge Function 后，再把 `workspace_invites` 的待处理记录转换成带签名的邀请链接。

通知基础设施位于 `supabase/migrations/20260826020000_notifications.sql`：`notification_events` 记录站内事件，`notification_deliveries` 为邮件、Webhook、企业微信和飞书投递预留队列。当前前端只创建站内事件，明确不会伪报外部渠道发送成功。

报告导出基础设施位于 `supabase/migrations/20260826030000_report_exports.sql` 和 `supabase/functions/report-export`。函数使用用户 JWT 验证身份，以服务端密钥写入私有 `reports` Storage bucket，并返回 1 小时有效的签名 URL；服务端不可用时前端才会明确降级为本地打印。

## 尚未做的事情

本迁移只建立权限基础设施，现有报告、看板和素材表仍按 `user_id` 隔离。下一步应为需要协作的业务表增加 `workspace_id` 与 `created_by`，并逐表迁移 RLS，避免一次性改变现有用户数据。
