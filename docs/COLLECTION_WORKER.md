# 独立采集 Worker 运行手册

第 10 步将高频采集、历史回填和第三方 API 调用从 GitHub Actions 移到独立 Worker。Actions 只负责测试、部署、低频健康检查和人工紧急入队。

## 部署

Worker 需要一个可持续运行的容器、虚拟机或任务服务。工作目录应包含本仓库和 `scripts/`，使用 Python 3.11 或更高版本。TikTok Shop 的规则目录是浏览器动态页面；启用该来源的生产 Worker 还要安装 Node.js 22、项目依赖和 Chromium：

```bash
npm ci
npx playwright install --with-deps chromium
```

然后启动 Worker：

```bash
python scripts/collection_worker.py --max-tasks 1 --poll-seconds 30
```

仓库提供了生产镜像 `Dockerfile.worker`。镜像包含 Node.js、Python 和 Playwright Chromium，但不会包含原始、付费或本地私有数据。启动时 `deploy/worker-entrypoint.sh` 会先运行 `bootstrap_worker_data.py --required`，从 `private-raw-data` bucket 恢复最新完整状态、核对 SHA-256 和大小，再注册心跳和领取任务。必须把持久卷挂载到 `/app/data`；没有恢复出完整的 countries、platforms、policies、rules 和 macro 状态时容器会直接失败，不会用公开摘要冒充完整数据。

本地验证容器可使用：

```bash
cp .env.example .env.worker
# 只在 .env.worker 中填写真实服务端密钥；该文件不会进入 Git
docker compose -f docker-compose.worker.yml up --build -d
docker compose -f docker-compose.worker.yml logs -f collection-worker
```

Render 可通过根目录的 `render.yaml` 创建一个 Background Worker 和 5 GB 持久盘。完成首次 Secrets 配置和 Pilot 后，生产服务跟随 `main` 自动部署；R10 调度器只认可连续 3 个带 `protocol_version=2` 的心跳，因此数据库迁移和容器切换期间仍走旧采集路径。其他容器平台使用同一个 Dockerfile，并保持单实例和 `/app/data` 持久卷；在采集器改为完全无状态前不要扩成多个不共享磁盘的实例。

生产环境建议使用进程管理器（systemd、容器编排平台或托管任务服务）保持两个或更多实例。多个实例可以安全并行领取任务，数据库的 `claim_collection_task` 使用行锁和 `SKIP LOCKED` 保证同一任务只会被一个租约持有者领取。现有 Python 采集器会写入仓库的 `data/` 工作目录，因此多实例部署时必须挂载同一个持久卷；没有共享卷时请先使用单实例，否则应先把采集器改为直接写私有 Storage/数据库。

## 环境变量

必须配置：

- `SUPABASE_URL`：Supabase 项目 URL。
- `SUPABASE_SERVICE_KEY`：只存放在 Worker 的密钥管理器，不提交到 Git 或 Actions 产物。

可选配置：

- `COLLECTION_WORKER_ID`：实例稳定标识；未设置时自动生成。
- `COLLECTION_WORKER_DEPLOYMENT_ID`：部署环境标识，例如 `render` 或 `compose`。
- `COLLECTION_WORKER_RELEASE_ID`：提交 SHA 或发布版本，用于定位当前运行代码。
- `COLLECTION_WORKER_LEASE_SECONDS`：任务租约，默认 900 秒。
- `COLLECTION_WORKER_POLL_SECONDS`：空队列轮询间隔，默认 30 秒。
- `COLLECTION_WORKER_BOOT_ID`：可选进程启动标识；不设置时每次进程启动自动生成，用于运行证据区分重启。
- 采集器所需的 `FRED_API_KEY`、`CENSUS_API_KEY`、`TIKHUB_API_KEY` 等供应商密钥。
- `ENABLE_BROWSER_PLATFORM_RULES=true`：当 TikTok Shop 首屏 HTML 没有规则记录时，允许使用无头浏览器读取官方动态页面；未启用或渲染失败时，该来源明确记为 `degraded`。
- `PLATFORM_BROWSER_TIMEOUT_SECONDS`：浏览器兜底超时，默认 90 秒。
- `PLAYWRIGHT_BROWSER_CHANNEL`：可选浏览器通道；容器安装 Playwright Chromium 时留空，本机只安装 Chrome 时可设为 `chrome`。

## 入队

日常任务应由调度器写入 `collection_tasks`。紧急手动运行 GitHub Actions 的 `Mercator Emergency Collection Enqueue`，或使用：

```bash
python scripts/enqueue_collection_tasks.py --collector collect_cpsc
python scripts/enqueue_collection_tasks.py --collector backfill_history \
  --parameters-json '{"source":"federal-register","from":"2020-01-01","to":"2020-12-31","cadence":"year"}'
```

入队脚本只接受登记的采集器和显式参数，数据库任务中的 `command` 字段不会被执行。批量入队会自动追加一个依赖所有采集任务的 `publish_formal` 任务，只有质量闸门通过后才同步正式投影。相同 `--run-id` 会生成相同的 `task_key`，可用于人工重试时避免重复入队。

### 单来源小范围 Pilot

部署 Worker 后，先在 GitHub Environment `production` 中同时设置 `COLLECTION_WORKER_CUTOVER=true` 和 `COLLECTION_WORKER_PILOT_ONLY=true`，再手动运行 `Collection Worker Pilot Cutover` workflow。Pilot-only 会让定时调度继续走旧路径，只允许手动 pilot 入队；默认只运行 `collect_cpsc`。workflow 只允许选择一个登记的采集器，自动追加该批次的 `publish_formal` 依赖，并等待两个任务都进入 `succeeded`。它会拒绝没有新鲜 Worker 心跳的环境，并在完成后检查任务尝试号、请求 ID、死信和重复尝试。

Pilot 失败时不要直接把任务批量改回 `queued`。先查看 workflow 产物中的 `collection-worker-pilot-result.json` 和 Worker 日志，确认失败来源、租约和预算状态，再使用新的 `run_id` 重试。

## 执行与恢复语义

每次领取会递增 `attempt_count` 并创建带 `lease_token` 和 `boot_id` 的租约。执行期间 Worker 定期调用 R10 续租 RPC；进程崩溃、重启或网络断开后，租约过期，下一实例会用新的 token 回收任务。尝试写入、来源结果和最终状态都校验 token，旧进程的迟到写入只会被记录为 fencing 拒绝。成功 attempt 已落库但最终状态未提交时，新实例只补齐完成状态，不再次调用来源。

每次尝试的 `request_id` 为 `collection:{task_id}:{attempt_number}`，预算使用独立的 `collection-budget:{task_id}:{execution}` 幂等键。预算 RPC 响应丢失、Worker 重启或同一次执行的租约恢复不会重复扣除整笔额度；已确认调用过供应商的失败重试会轮换预算键，避免低估真实费用。日志只保存状态、错误类型和截断诊断，不保存密钥或原始响应。

## 来源策略、熔断和发布闸门

`collection_source_policies` 为每个来源配置并发数、超时、退避、失败阈值、熔断窗口和冷却时间。熔断状态保存在数据库；冷却结束后数据库只签发一个 `half_open` 探针，探针成功才关闭，失败或租约丢失会重新打开。核心来源失败时，任务结果会带 `publication_blocked: true`；这只阻止正式发布，不会取消其他来源任务。

## TikHub 预算

迁移默认给 `tikhub` 设置每日 1,000 次请求和 25 USD 估算费用上限。Worker 在执行前调用 `reserve_collection_budget`，超过任一限制时不会启动采集器，任务进入可解释的 `budget_blocked` 状态，并按来源/日期/上限类型唯一写入 `collection_budget_alerts` 与 `system_incidents`。管理员应在确认账单后更新来源策略，不要绕过预算函数直接调用 API。

## 健康检查和运维

```bash
python scripts/collection_worker.py --health-check
```

该命令返回队列积压、有效租约、死信、预算阻断、打开/半开的熔断来源、TikHub 当日用量、`active_workers` 和通过防抖的 `r10_ready_workers`。`.github/workflows/collection-health.yml` 每 6 小时运行一次并只上传摘要产物。处理死信前先确认供应商恢复，再将任务状态改回 `queued` 并清理租约；暂停来源应把 `collection_source_policies.enabled` 设为 `false`。

验证 24 小时运行证据：

```bash
python scripts/collection_worker.py --runtime-evidence --window-hours 24
python scripts/collection_worker_r10_acceptance.py --window-hours 25 --required-hours 24
```

`collection_worker_heartbeat_samples` 保存带 `boot_id` 和协议版本的心跳样本；R10 证据输出包含心跳覆盖时长、最大间隔、重启次数、任务尝试去重计数、fencing/租约事件和窗口内任务状态。只有 `coverage_seconds >= 86400`、最大间隔符合阈值、重复 request/attempt 均为 0、没有未解释的 `dead_letter` 且当前 `r10_ready_workers > 0` 时才通过。安全重启允许 `boot_count > 1`，但不能造成心跳缺口或重复写入。`.github/workflows/collection-worker-r10-acceptance.yml` 每小时保存一次脱敏证据；满 24 小时前状态为 `observing`，不会伪报通过。

## 无中断切换

`.github/workflows/data-update.yml` 在迁移期继续保留旧的每 4 小时直采。安全切换顺序固定为：

1. 先部署 `20261002000000_collection_worker_runtime.sql` 和 `20261012000000_collection_worker_observability.sql`，保持 `COLLECTION_WORKER_CUTOVER=false` 或不创建该变量。
2. 部署新容器，确认 `active_workers >= 1`；设置 `COLLECTION_WORKER_CUTOVER=true`、`COLLECTION_WORKER_PILOT_ONLY=true`，运行单来源 Pilot，验证采集、质量校验、同步、发布和重启恢复。
3. 连续观察至少 24 小时运行证据；通过后关闭 `COLLECTION_WORKER_PILOT_ONLY`，让定时调度开始全量入队，保留 `COLLECTION_WORKER_CUTOVER=true`。
4. 后续定时任务在心跳正常时只入队，不再在 Actions 中采集；如果 Worker 心跳超过两分钟，下一次定时任务会自动回退旧直采。

因此不要删除 `legacy-update-data`，也不要在 Worker 心跳和完整批次证据出现前设置切换变量。生产 Worker 的 service key 只放托管平台 Secret；Actions 使用 Supabase CLI 临时解析的密钥，不写入产物或仓库。

## 自动回退演练与旧路径保留

调度路由由 `scripts/route_collection_schedule.py` 统一决定，并把健康快照和路由结果作为 workflow artifact 保存。路由是 fail-closed 的：健康查询失败、响应无法解析、Worker 心跳过期或 `r10_ready_workers=0` 时，结果只能是 `legacy`。Worker 恢复后必须积累至少 3 个近期 R10 心跳才安全切回。下一次定时运行会执行 `legacy-update-data`，不会因为 Worker 暂时掉线而静默跳过数据更新。

验证第 16 项时，先在 Render 暂停 `mercator-collection-worker`，等待数据库实例心跳超过两分钟，再手动运行 `Collection Worker Failover Drill`。该 workflow 只读健康状态，要求路由结果为 `legacy` 且 `worker_ready=false`，并上传 `collection-routing-decision.json`。完成后恢复 Worker，确认新的心跳恢复，再运行一次正常调度。

第 17 项的旧采集路径由 `.github/workflows/data-update.yml` 中的 `legacy-update-data` job 保留。满一周后人工运行 `Collection Worker Stability Gate`；它查询 169 小时窗口以覆盖首尾心跳边界，并要求至少 168 小时连续证据、单一启动会话、心跳最大间隔不超过 300 秒、无重复 request/attempt、无 dead-letter 且当前 Worker 健康。在该 gate 通过并由负责人审阅 artifact 前，不得删除或禁用 `legacy-update-data`。即使 gate 通过，也只代表可以评估移除，不会自动删除旧路径。
