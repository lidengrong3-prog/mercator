# Stripe 正式收费上线手册

## 安全边界

公众收费默认关闭。`BILLING_ENABLED=true` 只有在同一个隔离工作区完成全部 live-mode 证据、管理员确认 Stripe/Supabase/页面/账单门户一致，并通过发布工作流的二次校验后才会生效。

真实购买、付款失败、续费、取消和退款会影响真实资金与订阅。它们必须由平台负责人在 Stripe Dashboard 和专用验收账号中人工执行，自动化脚本只读取状态、记录最小证据和阻止误发布。不得使用真实客户工作区、客户支付方式或未经持卡人授权的银行卡。

数据库只保存 Stripe event/object ID、场景、通过状态、时间和必要检查结果，不保存卡号、账单地址、客户邮箱或完整 webhook payload。

## 前置配置

1. 在 Stripe live 模式创建最终公开销售的 Pro 月付 Price。验收和正式销售必须使用同一个 Price ID。
2. 在 Stripe 创建 live webhook endpoint：`https://<project-ref>.supabase.co/functions/v1/billing-webhook`。
3. 订阅 Checkout、subscription、invoice、charge refund 和 refund update 事件，事件清单见 `docs/PRODUCTION_ACCEPTANCE.md`。
4. 在 GitHub `production` Environment 配置 `STRIPE_SECRET_KEY=sk_live_...`、`STRIPE_PRICE_PRO_MONTHLY=price_...` 和该 endpoint 的 `STRIPE_WEBHOOK_SECRET=whsec_...`。
5. 建立专用验收账号、专用工作区和书面审批编号；账号不能是客户账号，工作区不能放业务数据。
6. 确认迁移 `20260929000000_stripe_live_acceptance.sql` 已部署。

`STRIPE_ALLOW_TEST_EVENTS` 在生产必须为 `false`。Stripe test 模式和 Test Clock 结果不能计入本闸门。

## 第一阶段：只开放隔离验收工作区

在 GitHub `production` Environment 设置：

```text
BILLING_ENABLED=false
BILLING_LIVE_ACCEPTANCE_MODE=true
BILLING_ACCEPTANCE_WORKSPACE_ID=<隔离工作区 UUID>
BILLING_ACCEPTANCE_RUN_ID=
```

执行一次 `Production release`。此时只有指定工作区的 owner/admin 能创建真实 Checkout 或打开账单门户，其他工作区仍得到 `BILLING_NOT_ENABLED`。

随后手工运行 `Stripe live acceptance` 工作流：

```text
action=start
workspace_id=<隔离工作区 UUID>
actor_id=<platform_admin 的 profile UUID>
approval_reference=<审批单或书面授权编号>
```

保存输出的 `run_id`。同一工作区同一时间只允许一个 `collecting` 运行。运行从创建起 60 天有效，以覆盖一个真实月付续费周期；超期后自动失效，必须创建新运行。

## 第二阶段：收集十项真实证据

| 场景 | Stripe 事实 | 系统通过条件 |
| --- | --- | --- |
| 购买 | paid Checkout | 工作区订阅为 active，订阅 ID 已解析 |
| 续费 | `invoice.paid` 且 `billing_reason=subscription_cycle` | 续费后仍为 active |
| 付款失败 | `invoice.payment_failed` | 状态变为 past_due 并暂停付费权益 |
| 付款恢复 | 失败后的 `invoice.paid` | 状态恢复 active，失败原因清空 |
| 周期末取消 | subscription updated | `cancel_at_period_end=true` 且到期前保留权益 |
| 立即取消 | subscription deleted | 状态为 cancelled；提前结束可被识别 |
| 部分退款 | 成功的 refund/charge 事件 | 记录部分退款但不撤销有效权益 |
| 全额退款 | 成功的 refund/charge 事件 | 记录全额退款并撤销付费权益 |
| Webhook 重放 | 同一 live event ID 再投递一次 | 返回 duplicate，`billing_events` 不产生第二笔权益变更 |
| 四端一致 | 人工核对加服务端读取 | Stripe、Supabase、页面、账单门户一致，且 Price ID 等于生产配置 |

可多次购买并使用多个订阅完成互斥场景，但所有事件必须属于同一个隔离工作区和同一个验收运行。续费必须等待最终 live 月付订阅的真实周期事件；不要用 test-mode Test Clock 代替。付款失败与恢复只能使用负责人和支付机构允许的受控方法，不得制造未经授权的扣款。

用 `action=status` 和 `run_id` 随时查看缺失项。管理后台“Stripe 正式收费验收”也会显示十项状态。

在 Stripe Dashboard 对一条已经成功处理的事件使用“Resend”，确认第二次投递返回 duplicate，订阅和用量均未重复变化。

## 第三阶段：核对并封存

逐项人工核对：

1. Stripe subscription 的客户、Price、状态、周期、取消标记与退款状态正确。
2. `workspace_subscriptions` 的 provider IDs、状态、周期、取消和退款字段一致。
3. 套餐页面刷新及退出重登后显示一致，失败状态不会继续授予 Pro 权益。
4. Stripe 账单门户显示同一订阅和取消状态。
5. `billing_events` 没有未解释的 failed/processing 记录，重放 event ID 只有一条业务处理记录。

然后运行 `Stripe live acceptance`：

```text
action=finalize
run_id=<运行 UUID>
actor_id=<platform_admin 的 profile UUID>
approval_reference=<最终审批编号>
confirm_page_and_portal=true
```

脚本会实时读取 Stripe，重新对比 Supabase，并写入 `state_consistency`。任一检查失败或任一场景缺失，运行不会成为 `passed`。

## 第四阶段：开启公众收费

先关闭验收模式，再设置已通过的运行：

```text
BILLING_LIVE_ACCEPTANCE_MODE=false
BILLING_ACCEPTANCE_WORKSPACE_ID=
BILLING_ACCEPTANCE_RUN_ID=<passed 运行 UUID>
BILLING_ENABLED=true
```

重新运行 `Production release`。发布工作流会在部署函数前检查：运行状态为 `passed`、十项 live 证据齐全，以及验收 Price ID 与当前 `STRIPE_PRICE_PRO_MONTHLY` 完全一致。检查失败则停止发布，前端不会被更新。

上线后再用负责人授权的小额账号完成一次购买和账单门户检查，并监控 webhook 失败率。该上线后冒烟不能替代上线前闸门。

## 停止和回滚

出现状态不一致、重复权益、webhook 签名失败、退款未撤权或无法解释的 billing event 时，立即设置 `BILLING_ENABLED=false` 并重新执行生产发布。不要删除 Stripe 或 Supabase 记录；保留 event ID 和运行 ID用于排查。

关闭新 Checkout 不会自动取消已有订阅。已有订阅必须按已公布条款在 Stripe 账单门户或 Dashboard 处理，并等待签名 webhook 同步到 Supabase。修复后创建新的验收运行，不复用已经代表旧配置的通过记录。
