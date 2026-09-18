# JAY观海 · 数据自动更新运行手册

目标：让独立 `scripts/collection_worker.py` 按队列执行真实来源采集、历史回填和第三方 API 调用，并在统一质量闸门通过后同步到 Supabase。GitHub Actions 不再承担高频采集。

目标生产方案是独立 Worker。迁移期间旧 GitHub Actions 直采仍作为自动兜底，只有显式切换并检测到新 Worker 心跳后才停止当次旧采集。

---

## 当前生产方案：独立 Worker

1. 按 [COLLECTION_WORKER.md](COLLECTION_WORKER.md) 配置一个或多个 Worker 实例。每个实例使用 `SUPABASE_SERVICE_KEY`，通过数据库租约领取任务。
2. 使用 `python scripts/enqueue_collection_tasks.py` 或 GitHub Actions 的 `Mercator Emergency Collection Enqueue` 将任务放入 `collection_tasks`；不要在 Actions 中直接执行采集器。
3. Worker 负责来源并发、超时、指数退避、熔断和 TikHub 每日 1000 次/25 USD 预算。重启后过期租约会自动回收，成功尝试会被幂等恢复。
4. `collection-health.yml` 每 6 小时检查实例心跳、积压、租约、死信、熔断和预算，只上传摘要。
5. 容器使用 `Dockerfile.worker`，把持久卷挂载到 `/app/data`。首次启动从私有 Storage 恢复完整状态并校验哈希，恢复失败时不会领取生产任务。

`data-update.yml` 继续保留每 4 小时调度。`scripts/route_collection_schedule.py` 对健康响应采用 fail-closed 路由：仅当 `COLLECTION_WORKER_CUTOVER=true`、`COLLECTION_WORKER_PILOT_ONLY=false` 且最近两分钟存在活跃 Worker 时改为入队；健康查询失败或 `active_workers=0` 时下一周期自动回退 `legacy-update-data`。Pilot 阶段把 `COLLECTION_WORKER_PILOT_ONLY=true`，定时调度会继续走旧路径，只有 `Collection Worker Pilot Cutover` workflow 能手动验证单一来源。

---

## 历史方案（仅本地开发/迁移参考）

三种方案任选其一（推荐顺序：A → B → C）。

---

## 公共前提

无论哪种方案，都需要以下两个 Supabase 凭证（写库用 **service_role**，绝不进仓库）：

| 变量 | 含义 | 获取位置 |
|---|---|---|
| `SUPABASE_URL` | 项目地址 | Supabase 控制台 → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | service_role key | Supabase 控制台 → Project Settings → API → `service_role` (secret) |

可选（仅在使用 AI 摘要时）：

| 变量 | 含义 |
|---|---|
| `AI_API_KEY` / `AI_API_URL` / `AI_MODEL` | 兼容 OpenAI 的摘要接口，缺省时退回纯文本摘要 |

> 测试单次同步（本地已配好上述环境变量）：
> ```bash
> cd D:/AI工具/mercator-main
> python scripts/collect_data.py --sync-only   # 只上传本地 JSON，不联网采集
> python scripts/collect_data.py --validate     # 离线校验 5 个数据文件结构
> python scripts/collect_data.py                # 按 configured 市场/平台采集并生成来源运行记录
> ```

---

## 方案 A：GitHub Actions（已停用高频采集）

文件 `.github/workflows/data-update.yml` 在迁移期保留每 4 小时调度：健康 Worker 可用时入队，健康检查失败时执行 `legacy-update-data` 旧采集兜底；高频执行的主路径仍是上面的独立 Worker。

### 启用步骤
1. 把本仓库推到 GitHub（见下方「推送命令」）。
2. 仓库 → **Settings → Environments → production → Environment secrets**，添加：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - 法规翻译可直接复用 `DEEPSEEK_API_KEY` / `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL`
   - 如需使用独立翻译服务，再添加 `REGULATORY_TRANSLATION_API_KEY` / `REGULATORY_TRANSLATION_API_URL` / `REGULATORY_TRANSLATION_MODEL`；独立配置优先
3. 需要紧急采集时，在 **Actions → Mercator Emergency Collection Enqueue → Run workflow** 选择采集器并提交；工作流只写入队列，不直接访问供应商 API。
4. 观察 **Collection Worker Health** 工作流的摘要，确认任务被 Worker 领取和完成。
5. 小范围切换时在 production Environment 设置 `COLLECTION_WORKER_CUTOVER=true` 和 `COLLECTION_WORKER_PILOT_ONLY=true`，运行 `Collection Worker Pilot Cutover`；通过 24 小时运行证据后再关闭 `COLLECTION_WORKER_PILOT_ONLY`。
6. 验证自动回退时暂停 Worker，等待心跳超过两分钟，运行 `Collection Worker Failover Drill`，确认 artifact 中 `mode=legacy`、`worker_ready=false`，再恢复 Worker。
7. Worker 稳定运行至少 168 小时后人工运行 `Collection Worker Stability Gate`。它查询 169 小时证据窗口并要求至少 168 小时连续覆盖；通过前保留 `legacy-update-data`，通过后也只进入人工评估，不自动删除旧路径。

“每 4 小时运行”表示每 4 小时尝试检查，不等于数据一定刷新。美国品类文件中的 `last_attempted_at` 可随运行推进；只有完整成功才推进 `last_checked_at`，只有事实内容变化才推进 `content_updated_at`/`generated_at`。若使用缓存，检查 `collection_status` 与 `cached_sections`；`failed` 或 `skipped` 会阻断发布，`degraded` 会进入质量告警。

### 推送命令（仓库初始化已完成，仅差 remote）
```bash
cd D:/AI工具/mercator-main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```
> 若使用 GitHub 连接器：在左侧连接器面板连接 GitHub 后，可用 `gh` 创建仓库并推送；当前环境 `gh` 未安装、连接器断开，故需你提供仓库 URL 或先连接。

### 说明
- 政策与规则采集只使用 `market_scope.json` 中 `data_status=configured` 的市场和市场平台关系；`schema_only` 不会发起采集。
- 采集结果只进入统一政策/规则事实记录，不再轮询旧39国目录、66个平台，也不再把搜索标题写回国家/平台档案。
- `collection_run.json` 逐来源记录成功、失败和耗时；核心来源失败后 `validate_data.py` 返回非零状态并阻止同步。
- 若公开投影有变化，会在全部质量检查和私有同步通过后按显式白名单提交；原始响应、运行日志、隔离数据和美国品类源文件不会被 `git add`。

---

## 方案 B：本机定时任务（不依赖 GitHub）

适合：仓库不公开、或想完全自托管。

### B-1 Linux / macOS（cron）
```bash
# 写入日志目录
mkdir -p /opt/mercator/logs

# 编辑 crontab
crontab -e
# 加入下行（每 4 小时第 15 分运行；venv 路径按需修改）
15 */4 * * * cd /opt/mercator/mercator-main && /opt/mercator/venv/bin/python scripts/collect_data.py >> /opt/mercator/logs/collect.log 2>&1
```

### B-2 Windows（任务计划程序 / schtasks）
保存为 `D:/AI工具/mercator-main/run_collect.bat`：
```bat
@echo off
cd /d D:\AI工具\mercator-main
"C:\Users\15961\.workbuddy\binaries\python\versions\3.13.12\python.exe" scripts/collect_data.py >> logs\collect.log 2>&1
```
注册定时任务（每 4 小时）：
```powershell
schtasks /create /tn "MercatorDataUpdate" /tr "D:\AI工具\mercator-main\run_collect.bat" /sc hourly /mo 4 /st 00:15 /ru SYSTEM
```
> 环境变量（`SUPABASE_URL` 等）请在该任务「操作 → 编辑 → 起始于」同级的「环境变量」中设置，或在 `.bat` 内用 `set SUPABASE_URL=...` 注入（注意别把 key 提交进仓库）。

### B-3 守护进程（可选，更稳）
用 `supervisord` / `pm2` 包装一个常驻进程，内部 `while True: collect(); sleep(4h)`。对单脚本场景非必需，cron/schtasks 已足够。

---

## 方案 C：Supabase 自家调度（Edge Function + pg_cron）

适合：已用 Supabase 托管、希望调度也落在 Supabase 内、不暴露 GitHub。

### C-1 新建 Edge Function（Deno/TS）
`supabase/functions/collect-and-sync/index.ts`：
```ts
// 通过 GitHub Actions 的 workflow_dispatch 触发既有采集脚本（复用 Python 采集逻辑，避免用 TS 重写）
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const GH_REPO = Deno.env.get("GH_REPO")!;        // 例: "owner/repo"
const GH_TOKEN = Deno.env.get("GH_PAT")!;        // 具备 workflow 权限的 Personal Access Token

serve(async (_req) => {
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/data-update.yml/dispatches`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GH_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  const ok = res.ok;
  return new Response(JSON.stringify({ dispatched: ok, status: res.status }), {
    headers: { "Content-Type": "application/json" },
    status: ok ? 200 : 502,
  });
});
```
部署：
```bash
supabase functions deploy collect-and-sync --no-verify-jwt
supabase secrets set GH_REPO=owner/repo GH_PAT=ghp_xxx
```

### C-2 pg_cron + pg_net 周期调用
在 Supabase SQL Editor 执行（需启用 `pg_cron`、`pg_net` 扩展）：
```sql
-- 启用扩展（项目设置 → Database → Extensions 中开启，或）
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 每 4 小时调用 Edge Function
select cron.schedule(
  'mercator-collect',
  '15 */4 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/collect-and-sync',
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  $$
);
```
> 说明：该方案本质是「Supabase 定时器 → 触发 GitHub Action 采集 → 回写 Supabase」，兼顾零重写与 Supabase 内调度。若不想依赖 GitHub，可把 `collect-and-sync` 改成直接执行采集逻辑（需把 `collect_data.py` 的采集部分用 TS/Pl/边缘运行时重写），工作量更大。

---

## 校验清单

- [ ] `python scripts/collect_data.py --validate` 通过（5 文件结构 OK）
- [ ] `data/collection_run.json` 为 v2，市场/平台范围与目录一致，顶层 `status` 与 `summary` 和来源明细一致，`summary.core_failures` 为空
- [ ] `data/collection_run.json` 同时包含 `us_market_categories`、`cpsc_recalls` 和 `fred_bls_macro`，而不是只包含政策/规则来源
- [ ] Actions 质量工件只包含 `data/quality_report.json`，且其 `collection_run` 字段为不含原始响应的诊断摘要
- [ ] `quality_report.json.collection_run` 与账本的版本、完成时间、范围和缺失来源一致
- [ ] `python scripts/collect_data.py --sync-only` 后，线上 `market_data` 含 5 个 key（countries/platforms/policies/rules/alerts）
- [ ] 定时触发后，Supabase `market_data.updated_at` 出现新时间戳
- [ ] `private_data_artifacts` 能查到本轮原始/隔离对象，匿名与普通登录用户无法读取该表或 `private-raw-data`
- [ ] `python scripts/repository_privacy_check.py` 通过，Git 跟踪文件中不存在受限目录和供应商密钥
- [ ] SPA 中 `JAY_REFRESH_DEMO` 在生产环境设为 `false`，使 2h 周期刷新真正套用实时数据

---

## 线上现状（2026-08-10 核实）

| 项目 | 状态 |
|---|---|
| 仓库 | `https://github.com/lidengrong3-prog/mercator`（public，默认分支 `main`） |
| Actions「Mercator Data Update」 | **正常运行**，每 4h，最近 `2026-08-10T05:11Z` success |
| Supabase secret | **已配置生效**（`market_data.updated_at` 与 Action 运行时刻吻合） |
| GitHub Pages | **已启用在线**：`https://jayguanhai.com/`，每次 push 到 main 自动重新部署 |

> 早期文档中「Actions 未运行」的判断已作废，以本表为准。

---

## 人工基线保护机制（防止自动采集稀释人工数据）

**背景**：采集器 `merge_data()` 是「合并去重」而非覆盖，但有条目上限，长期运行会把最早的人工整理条目挤出去。

**机制**：
- `data/policies_baseline.json`、`data/rules_baseline.json` 是本地/私有采集输入，已从公开 Git 跟踪中移除；正式环境应从私有 Storage 恢复后再运行采集。
- 每次采集时自动并入（按标题去重），且**在裁剪时豁免**——基线条目不占用 `ITEM_CAP`（当前 400）额度。
- 需要新增/修订人工条目时只在受控环境编辑并上传私有 Storage，不得通过公共 Pull Request 分发。

**命令**：
```bash
# 把当前 data/rules.json 快照为人工基线
python scripts/collect_data.py --make-baseline rules

# 离线把基线并回数据文件（不联网、不写库）
python scripts/collect_data.py --merge-baseline
```

**效果实测**：`rules` 27 → 159 条，`policies` 155 → 226 条，零丢失。

---

## 分支推送流程（本地 dev → 远端）

本地仓库与 `origin/main` 是 **unrelated histories**（本地 2026-08-10 才 `git init`）。已按下述策略组装 `dev` 分支：

- **代码取本地**（index.html / scripts / supabase / docs / .gitignore / workflow）
- **数据取远端**（policies / countries / platforms，采集器持续更新更新鲜）
- **`alerts.json` 由本地新增**（远端从未有过）
- **`rules` / `policies` 执行基线并集**

```bash
cd D:/AI工具/mercator-main
git push -u origin dev            # 推测试分支，不影响公开 Pages 站点
# 在 GitHub 上开 PR: dev → main，确认 diff 后合并
# 合并到 main 后，Pages 会自动重新部署为新前端
```

> 推送需 GitHub 凭据：连接 GitHub 连接器，或本机 `git config --global credential.helper manager` 后首次 push 时登录，或使用 PAT。

---

## 常见坑

1. ~~**git remote 为空 → GitHub Actions 实际不跑**~~：已修正，remote 已配置且 Actions 在正常运行（见上方「线上现状」）。
2. **service key 绝不写进仓库**：仅放 GitHub Secrets / 本机环境变量 / Supabase Secrets。
3. **CSP 放行 CDN**：`index.html` 的 CSP 须含 `script-src ... https://cdn.jsdelivr.net`，否则 supabase-js 被拦截、登录/同步失效（已处理）。
4. **演示模式**：`JAY_REFRESH_DEMO=true` 时周期刷新走演示演进、不套实时数据；正式上线改 `false`。
