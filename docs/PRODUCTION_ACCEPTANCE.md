# 生产发布与验收

## 发布顺序

`.github/workflows/deploy-production.yml` 是正式发布入口，顺序固定为：

1. 代码、数据质量、桌面端和移动端测试。
2. Supabase 数据库迁移。
3. Edge Function Secrets 与函数部署。
4. 两个真实测试账号的端到端验收。
5. GitHub Pages 前端部署。
6. 已部署正式站的真实浏览器账号验收。
7. 正式站和 Supabase API 冒烟检查。

任何步骤失败都会阻止后续步骤。GitHub Pages 的 Source 必须设置为 GitHub Actions，不能继续使用绕过该工作流的分支自动发布。

发布工作流还会在质量门禁阶段拒绝非 `main` 分支和脏工作区，并检查迁移文件名的时间顺序、基础对象覆盖率及逐文件表依赖。数据库必须能够从 `20260824000000_database_foundation.sql` 开始，仅依赖 `supabase/migrations/` 完成空库重建；`schema.sql`、`phase2_schema.sql`、`monitored_shops.sql` 和 `add_indexes.sql` 不再手工执行。`db push --include-all` 后再次读取远端 migration 列表，要求最新版本在本地和远端一致。生产 `ALLOWED_ORIGINS` 必须严格等于正式站的 `https://域名` origin，不能包含本地地址、路径或通配符。前端部署包由 `scripts/build_public_site.py` 按严格白名单组装，并写入 `release.json` 和 `public-data-manifest.json`；最后的 smoke 会核对提交 SHA、迁移头、正式 origin、公开数据清单、私有数据 404、数据库和所有 Edge Function 路由。

数据库变更合入前应保留一次本地 `npx supabase db reset` 成功记录，并运行 `python scripts/validate_migration_chain.py`。前者验证真实 PostgreSQL/Supabase 执行，后者在普通 CI 和生产预检中防止根对象或依赖顺序再次漏出迁移链。

Pages 数据验收必须确认 10 个白名单 JSON 均可读取，且 `_cfd_part1.json`、`_ext_part1.json`、`macro_raw.json`、`alerts_detailed.json`、`*_baseline.json`、`quarantine_*`、`_sync_logs/`、`us_market/cpsc_recalls.json`、美国品类 JSON 与索引均不可访问。政策、规则、税收、准入、预警和宏观指标中的公开记录必须全部为当前范围内的 `verified/uploaded` 正式记录，不得出现演示数据或第三方行业资讯。

定时数据更新还必须生成 v2 `data/collection_run.json`。验收时确认它只包含 `market_scope.json` 中 `data_status=configured` 的市场和平台，且至少有政策/规则、`us_market_categories`、`cpsc_recalls`、`fred_bls_macro` 四类来源记录；逐来源请求数与耗时完整，顶层 `status`、`summary` 与来源明细一致，质量报告中的 `collection_run` 快照与其版本、完成时间和范围一致。核心来源失败、流水线来源缺失或账本缺失时，`validate_data.py` 和 `sync_to_supabase.py` 必须阻止 Supabase 同步和数据提交。

预警验收还需抽查 `data/alerts.json` 的每条记录：来源 URL、原始记录 ID、发布日期、采集时间、核验时间、核验状态、核验说明和证据哈希必须齐全；预警的 `source_kind`/`source_type` 应为 `derived`，并能通过 `source_record_id`（聚合预警通过 `source_record_ids`）回溯到已核验的政策或 CPSC 原始记录。缺少历史时间或仍为 `pending` 的旧预警不得进入正式统计，生成器升级后也不得继续保留旧版本预警。

## Production Environment

在 GitHub `production` Environment 中配置：

- Secrets：`SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_ID`、`SUPABASE_DB_PASSWORD`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`。
- AI Secrets：`DEEPSEEK_API_URL`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`ALLOWED_ORIGINS`。
- 定时法规翻译默认复用上述 DeepSeek Secrets；如需独立翻译服务，可配置 `REGULATORY_TRANSLATION_API_URL`、`REGULATORY_TRANSLATION_API_KEY`、`REGULATORY_TRANSLATION_MODEL`，独立配置优先。
- 限流与成本：`AI_REQUESTS_PER_MINUTE`、`AI_MONTHLY_TOKEN_LIMIT`、`AI_INPUT_COST_PER_MILLION_USD`、`AI_OUTPUT_COST_PER_MILLION_USD`。
- Stripe（正式收费前）：`STRIPE_SECRET_KEY`、`STRIPE_PRICE_PRO_MONTHLY`、`STRIPE_WEBHOOK_SECRET`。
- Variables：`BILLING_ENABLED`、`BILLING_LIVE_ACCEPTANCE_MODE`、`BILLING_ACCEPTANCE_WORKSPACE_ID` 和 `BILLING_ACCEPTANCE_RUN_ID`。未完成 Stripe live-mode 验收前 `BILLING_ENABLED` 必须保持 `false`。
- 团队邀请 Secrets：`RESEND_API_KEY`、已验证的 `WORKSPACE_INVITE_FROM_EMAIL`；`APP_PUBLIC_URL` 由 `PRODUCTION_SITE_URL` 写入 Edge Function。
- 通知 Secrets：`NOTIFICATION_CONFIG_ENCRYPTION_KEY`、`NOTIFICATION_FROM_EMAIL`。通知发件地址必须与 `WORKSPACE_INVITE_FROM_EMAIL` 独立。
- 通知 Variables：`NOTIFICATION_CHANNELS_ENABLED`、`NOTIFICATION_LIVE_ACCEPTANCE_MODE`、`NOTIFICATION_ACCEPTANCE_WORKSPACE_ID`、`NOTIFICATION_ACCEPTANCE_RUN_ID` 和 `NOTIFICATION_ALERT_MAX_AGE_DAYS`（默认 `7`，允许 `1-30`）。完成 15 项真实渠道验收前 `NOTIFICATION_CHANNELS_ENABLED` 必须保持 `false`。
- 双账号验收：`PROD_TEST_USER_A_EMAIL`、`PROD_TEST_USER_A_PASSWORD`、`PROD_TEST_USER_B_EMAIL`、`PROD_TEST_USER_B_PASSWORD`。
- Variable：`PRODUCTION_SITE_URL`，设置为 `https://jayguanhai.com/`。

Stripe 后台的 webhook URL 必须配置为 `https://<project-ref>.supabase.co/functions/v1/billing-webhook`，并订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.paid`、`invoice.payment_failed`、`invoice.payment_action_required`、`invoice.marked_uncollectible`、`charge.refunded` 和 `refund.updated`。只有签名验证成功的 live-mode 事件可以更新会员；重复事件按 Stripe event ID 去重，失败事件和超过 5 分钟未完成的处理事件可以安全重试，旧事件不得覆盖较新的订阅状态。生产环境不得设置 `STRIPE_ALLOW_TEST_EVENTS=true`。完整的 live 验收、开启顺序和回滚流程见 [STRIPE_LIVE_BILLING.md](STRIPE_LIVE_BILLING.md)。

## Stripe 正式收费验收

正式收费使用以下权益口径：预约周期末取消时，权益保留到 `current_period_end`；立即取消、付款失败、无法收款或周期过期后降级到免费套餐；部分退款只记录退款状态，不自动取消仍有效的订阅；全额退款立即暂停付费权益，后续新的成功账单或新订阅可以恢复。`effective_billing_plan()` 是服务端唯一有效套餐口径，前端显示的 `profiles.tier` 只作为缓存，不能用于服务端授权。

套餐额度必须在服务端验收：报告和导出使用事务锁及数据库触发器，PDF/DOCX 同时检查套餐功能权限；AI 请求在调用供应商前原子预占本次最大 Token，完成后登记实际 Token，失败时释放，超时预占 10 分钟后自动释放。不得只依赖前端按钮禁用或调用前的普通查询。

打开生产收费前按顺序保留验收证据：

1. 先在 Stripe test 模式完成开发回归，确认 `billing_events` 只有一条对应 event ID，当前工作区的 `workspace_subscriptions` 更新，且页面套餐状态与服务端 `effective_billing_plan(workspace_id)` 一致；test 结果不计入 live 发布证据。
2. 保持 `BILLING_ENABLED=false`，仅对 `BILLING_ACCEPTANCE_WORKSPACE_ID` 开启 live 验收模式；在同一验收运行内完成购买、续费、周期末取消、立即取消、付款失败、付款恢复、部分退款和全额退款。
3. 重放同一 webhook、先发送新事件再发送旧事件，并模拟处理超过 5 分钟后重试；不得重复开通、回退到旧状态或永久卡在 `processing`。
4. 分别把免费版和 Pro 的 AI、报告、导出额度调到小值，验证并发请求不会越额，重复请求不会重复计数，免费版不能创建正式 PDF/DOCX。
5. 检查 `billing_events.processing_status='failed'`、过期的 `ai_token_reservations.status='reserved'` 和订阅状态异常；三项均无未解释记录后才进入 live-mode 小额验收。
6. 使用专用生产账号完成受控 live-mode 全场景验收，核对 Stripe、Supabase、页面和账单门户四处一致。真实资金操作必须由负责人明确授权并人工执行，脚本不得代操作。
7. `stripe_live_acceptance_runs` 成为 `passed` 且当前生产 Price ID 与一致性证据相同后，才关闭验收模式并把 `BILLING_ENABLED` 设为 `true`；任一项未通过时保持 `false`。

两个测试账号必须是不同的专用账号，不得使用管理员或真实客户账号。API 验收记录使用稳定客户端 ID，并在同一 CI 运行内复用幂等键；不同运行使用新的运行标识，避免上一次失败的导出任务阻塞重试。浏览器验收会使用带运行时间的标题创建一份独立 UI 报告，避免误打开旧验收结果，因此专用验收账号应定期清理历史导出文件。

## 验收数据隔离与补偿清理

每次 API/浏览器验收共用 `ACCEPTANCE_RUN_ID`（发布工作流使用 `github.run_id-github.run_attempt`）。迁移 `20260911000000_production_acceptance_isolation.sql` 建立 service-role 专属的 `production_acceptance_runs` 运行登记，并为工作区、商品/店铺、素材、报告、运行、导出、邀请、用户活动、AI 日志和 Token 预占记录增加 `acceptance_run_id`。运行开始时由 `start_production_acceptance_run()` 创建两个临时 owner 工作区，账号 A 使用 A 工作区、账号 B 使用 B 工作区作为各自的隔离起点；浏览器随后邀请 B 加入 A 的临时工作区，整个协作验收仍在临时空间内完成。

验收结果 JSON 只输出运行号、工作区 ID、报告/运行/导出/邀请 ID、检查布尔值、状态和错误摘要，不写入报告正文、AI Prompt 或完整回答。`cleanup_production_acceptance_run()` 先删除 `reports` Storage 中按导出路径和运行目录匹配的对象，再删除导出、报告、素材、商品/店铺、观察列表、用户活动、AI 日志/预占、邀请和临时工作区；运行登记保留为 `cleaned`，只留下各类删除计数和必要错误。运行中被强制中断时，清理器会把终止原因记为 `timed_out`，重复执行是幂等的。

API 进程退出钩子处理正常结束、异常和 KeyboardInterrupt；生产工作流还配置了独立的 `always()` 清理 Job，覆盖 GitHub 强制超时导致进程来不及执行钩子的情况。API 成功会暂缓清理，交由浏览器验收结束后统一清理；API 失败立即清理。`operations.yml` 每六小时调用 `cleanup_production_acceptance.py --expired --retention-days 7`，会清理超过保留期的完成记录，以及运行/清理超过一小时的遗留记录。可以手工执行：

```bash
ACCEPTANCE_RUN_ID=12345-1 python scripts/cleanup_production_acceptance.py --run-id 12345-1
python scripts/cleanup_production_acceptance.py --expired --retention-days 7
```

验收账号的正常工作区不会被此流程使用或删除。验收完成后应抽查 `production_acceptance_runs.cleanup_summary` 和测试账号的正常 owner 工作区，确认连续三次运行没有新增测试商品、素材、报告或导出。

## 验收内容

`python scripts/production_acceptance.py` 会实际验证：

- 两个账号都能真实登录。
- 账号 A 加入报告素材并保存一份上传数据快照。
- 账号 B 不能读取账号 A 的素材和上传数据。
- AI Edge Function 能生成简体中文内容，并写入模型、Token、耗时和成本日志。
- 报告保存成功，重新登录后仍可恢复。
- 账号 B 不能读取或导出账号 A 的报告。
- PDF 和 DOCX 能生成、下载并关联同一报告 ID。
- 账号 B 不能读取导出历史，也不能为账号 A 的 Storage 文件签发 URL。
- 账号 A 同样不能读取或导出账号 B 的报告、素材、上传记录和 Storage 文件。
- A 邀请 B 加入团队工作区后，B 能按角色读取共享报告、素材和看板；编辑者可以写入，查看者写入失败。
- B 被移出或停用后，再次读取该工作区数据失败；B 自己的其他工作区数据不受影响。
- 邀请页面只有在 Resend 返回消息 ID 后显示“邀请邮件已发送”，失败时保留供应商失败状态和原因。

### 生产异常验收

同一 API 验收还会对已部署的生产函数和数据库真实发起异常请求：无令牌请求必须返回 401，非法 Origin 必须返回 403；签名故障请求分别触发 429、AI 供应商超时和 AI Token 额度不足，并核对 `ai_request_logs` 的错误码。超时请求还必须把 `ai_token_reservations` 释放为 `released`。两次并发报告生成必须只留下一个 `report_runs`，两次并发 PDF/DOCX 请求必须返回同一导出 ID 且数据库各只有一行。

429、额度和超时使用请求级故障注入，避免修改生产套餐或全局 AI 配置。故障头由 CI 使用 `SUPABASE_SERVICE_KEY` 生成 HMAC-SHA256，有效期五分钟，并绑定测试用户、场景和请求 ID；签名错误直接返回 403。service-role key 本身不会发送到 Edge Function 请求，也不会进入验收产物或日志。普通浏览器不能触发这些场景。

部署完成后，`RUN_PRODUCTION_ACCEPTANCE=1 npm run test:browser:production` 会在正式站使用新的浏览器上下文验证：

- 账号 A 通过页面上传 CSV/JSON，并确认素材进入云端素材池。
- 账号 A 通过页面完成模板选择、报告生成、云端保存，并从报告页触发 PDF/DOCX 服务端导出。
- 账号 A 刷新页面、重新登录后恢复报告和导出历史。
- 账号 B 通过页面获得独立工作区，且不能读取账号 A 的素材、上传数据、报告或导出历史。
- 浏览器将一次带唯一请求 ID 的 `billing-status` 请求断开，客户端只能重试一次；第二次请求必须真实到达生产函数并恢复成功。

浏览器验收不会在普通本地 `npm run test:browser` 中自动运行，避免误用生产账号；生产工作流在前端部署后显式开启。API 与浏览器分别生成验收 JSON，最终 production smoke 会逐项检查 401、403、429、AI 超时、额度不足、断网恢复、重复生成和重复导出证据，缺项即失败。

## 外部通知验收

发布工作流会部署 `notification-dispatch`，并在最终 smoke 中使用真实账号读取三个渠道的服务端状态。完整的隔离验收模式、15 项证据、配置指纹与回滚步骤见 [NOTIFICATION_LIVE_ACCEPTANCE.md](NOTIFICATION_LIVE_ACCEPTANCE.md)。打开 `NOTIFICATION_CHANNELS_ENABLED=true` 前，使用专用验收账号在“设置 → 预警订阅”完成以下受控检查：

1. 保存邮件、企业微信和飞书配置后，页面只显示登录邮箱或 Webhook 的脱敏目标，刷新后仍不能读取原始 Webhook。
2. 三个“发送测试”分别收到真实供应商回执后，页面才显示“最近测试成功”；无效 URL、超时和供应商拒绝必须显示失败。
3. 选择一个明确的市场、平台和品类范围并保存订阅，确认范围外预警不会生成 `notification_events`。
4. 重复运行 `.github/workflows/notification-delivery.yml`，同一 `source_record_id` 不得生成重复事件或重复待发送任务。
5. 暂停一个渠道后，新通知不再为该渠道排队；失败任务按退避时间重试，五次后停止自动重试。
6. 账号 A 不能读取账号 B 的渠道配置、通知事件和投递记录，普通用户永远不能读取 `secret_ciphertext`。

## 分阶段开放

公众开放由数据库状态控制，必须依次经过内部账号、邀请制内测、公开测试和正式发布。负载、安全、成本、容量、14 天事故窗口以及收费/通知/客服/值班证据要求见 [STAGED_PUBLIC_ROLLOUT.md](STAGED_PUBLIC_ROLLOUT.md)。当前未形成生产证据时保持 `internal`，不得直接跳到正式发布。

## 可观测性口径

- `report_runs`：用户、报告 ID、市场/平台/品类范围、数据版本、章节数、总耗时和失败章节。
- `ai_request_logs`：运行 ID、模型、输入/输出 Token、估算成本、耗时、HTTP 状态和错误码。
- `report_exports`：报告 ID、格式、幂等键、耗时、状态和失败原因。

日志不保存 Prompt、报告正文或原始上传文件。AI 成本只有在配置供应商每百万 Token 单价后才具有财务意义；未配置时为 `0`，不能当作免费调用结论。
