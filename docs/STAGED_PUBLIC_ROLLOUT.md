# 分阶段开放与容量验收

生产开放状态由数据库中的单例 `production_rollout_state` 决定，默认且当前应保持 `internal`。阶段只能按 `internal -> invite_beta -> public_beta -> general` 前进；不能跳级，也不能只修改前端文案来开放注册。

## 四个阶段

- `internal`：仅 allowlist 或有效邀请中的开发、数据核验账号可以注册。
- `invite_beta`：10-30 名邀请用户；注册仍要求 allowlist 或有效邀请。
- `public_beta`：允许公开注册，但受 `registration_limit` 限制，并对每名用户执行数据库原子的每日 AI Token 上限。
- `general`：正式发布。必须已完成收费、通知、客服和运维值班证据，并满足连续 14 天稳定窗口。

每次晋级先运行 `Production readiness and staged rollout` 工作流的 `start`。所有证据属于同一 readiness run，完成后执行 `finalize`，最后才执行 `advance`。数据库会再次确认来源阶段、目标阶段、管理员身份、运行有效期和证据完整性。

## 负载测试

`scripts/production_load_acceptance.mjs` 只允许 100、500 或 1000 个并发读取用户，测试正式页面和服务端历史搜索，输出请求数、错误数、错误率、P50、P95、P99 和搜索 P95。它默认不调用 AI、报告或导出，避免无意产生供应商费用。

生产压测必须在负责人批准的时间窗口通过手动工作流触发。1000 并发还必须显式传入 `--confirm-production-window`。默认阈值是错误率不超过 1%、总体 P95 不超过 3 秒、搜索 P95 不超过 4 秒；调整阈值前需要变更记录，不能在测试失败后临时放宽。

负载 JSON 自带 SHA-256 摘要。`production_readiness.py load` 会验证摘要，将汇总写入 `production_load_test_runs`，并把对应 `read_100/read_500/read_1000` 证据写入 readiness run。访问令牌只在运行内生成和掩码，不进入工件。

## 安全与运维证据

邀请制内测前必须验证大文件、恶意文件、超长 Prompt、重复提交、浏览器兼容、移动端、账号删除、工作区删除、备份恢复、数据隔离、报告引用和第三方标识。公开测试还要求 100/500 并发、AI/报告/导出限流、数据库连接和查询耗时、Storage 流量、弱网、月度成本及容量预算。正式发布增加 1000 并发、14 天稳定窗口、收费、外部通知、客服和运维值班。

文件上传在 Storage 前经过 `security-gate`：按用途限制大小、扩展名、MIME 和文件头，拒绝可执行文件、活动 HTML/script、危险双扩展名和伪装文件。资源服务注册时再次校验格式、MIME、大小和 Storage 路径。生产还应在私有隔离区配置恶意软件扫描；浏览器检查不能替代服务端扫描。

AI 的公开测试每日额度与工作区月度额度同时生效。调用供应商前必须同时预占；任一路径失败都释放两个预占。过期预占会在事务锁内归还 `reserved_tokens`，重复 request ID 不会重新调用供应商。

## 正式发布条件

进入 `general` 前，当前 `public_beta` 阶段必须已运行至少 14 天。最近 14 天任何未解决或未解释的 P0/P1 都会由数据库阻断晋级。管理员后台显示当前阶段、注册/AI 上限、最近 readiness run、负载结果和未解释事故数。

`billing_ready` 必须来自 Stripe live 验收，`notification_ready` 必须来自外部通知 15 项验收；`support_ready` 和 `oncall_ready` 由负责人附变更单或值班表记录。事故、成本或容量超预算时不应把失败证据改成人工通过，应先修复并重新测试。
