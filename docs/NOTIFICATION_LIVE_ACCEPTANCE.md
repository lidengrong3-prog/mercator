# 外部通知正式验收

外部通知使用失败关闭的双闸门。日常生产必须保持 `NOTIFICATION_CHANNELS_ENABLED=false`；真实验收期间只设置 `NOTIFICATION_LIVE_ACCEPTANCE_MODE=true`，且必须同时指定一个隔离工作区和一条未过期的验收运行。两个开关不能同时为 `true`。

## 生产配置

GitHub `production` Environment 需要以下 Secrets：

- `NOTIFICATION_CONFIG_ENCRYPTION_KEY`：至少 24 个字符，只用于服务端 AES-GCM 加解密。
- `RESEND_API_KEY`：只能放在 Secrets。
- `NOTIFICATION_FROM_EMAIL`：Resend 已验证的通知发件地址，例如 `alerts@example.com`。
- `WORKSPACE_INVITE_FROM_EMAIL`：独立邀请发件地址，例如 `invites@example.com`，不得与通知发件地址相同。

验收期间设置 Variables：

- `NOTIFICATION_CHANNELS_ENABLED=false`
- `NOTIFICATION_LIVE_ACCEPTANCE_MODE=true`
- `NOTIFICATION_ACCEPTANCE_WORKSPACE_ID=<隔离工作区 UUID>`
- `NOTIFICATION_ACCEPTANCE_RUN_ID=<验收运行 UUID>`

`notification-delivery` 在验收模式只领取该工作区且 `payload.acceptance_run_id` 相同的任务。普通工作区的任务不会被领取，普通用户也不能调用 `acceptance_probe`。

## 验收顺序

1. 运行 `Notification live acceptance` 工作流的 `start`，取得运行 ID。
2. 把工作区 ID、运行 ID 和验收模式写入 production Variables，重新运行生产部署，使 Edge Function 获得限定范围。
3. 验收账号分别配置邮件、企业微信和飞书。页面与日志只显示脱敏目标，不返回 Webhook 密文。
4. 每个渠道运行一次 `probe/sent`，真实收到消息后保留供应商回执。
5. 每个渠道运行一次 `probe/failure_retry`。函数先向受控无效目标发送并取得真实拒绝，再用正式目标重试；同一 delivery 必须形成第 1 次失败和第 2 次成功两条不可变尝试记录。
6. 在页面停用对应渠道，再运行 `probe/disabled`；确认新事件没有生成该渠道 delivery。三个渠道分别执行，随后按需要恢复配置。
7. 运行 `configuration`，记录加密密钥、Resend Key 和发件邮箱的 SHA-256 指纹，不记录原值。
8. 运行 `deduplication`，确认同一 `source_record_id` 只产生一个事件。
9. 使用验收用户令牌和另一个工作区 ID 运行 `isolation`，必须返回 `403 WORKSPACE_FORBIDDEN`。
10. `status` 显示 15/15 后运行 `finalize`。

真实消息由负责人确认接收。脚本不会输出正文、Webhook URL、API Key 或 service-role key；Actions 工件只保留运行 ID、delivery ID、状态、错误码和配置指纹。

## 正式开启与回滚

通过后先设置 `NOTIFICATION_LIVE_ACCEPTANCE_MODE=false`，保留已通过的 `NOTIFICATION_ACCEPTANCE_RUN_ID`，再设置 `NOTIFICATION_CHANNELS_ENABLED=true` 并发布。部署会重新计算当前密钥和发件地址指纹；任一配置在验收后发生变化，公开通知会被阻止，必须重新验收。

发现错发、重复发送、跨工作区读取或供应商异常时，立即把 `NOTIFICATION_CHANNELS_ENABLED=false` 并重新部署。未发送任务保留在数据库中，恢复前检查 `notification_delivery_attempts`、重试次数和来源去重键，不能直接批量重放。
