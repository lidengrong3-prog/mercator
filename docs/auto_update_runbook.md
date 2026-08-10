# JAY观海 · 数据自动更新运行手册

目标：让 `scripts/collect_data.py`（真实数据源采集 → Supabase `market_data` 全 5 key 落库）**真正自动、周期性运行**，无需人工介入。

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
> python scripts/collect_data.py                # 全量采集 + 落库
> ```

---

## 方案 A：GitHub Actions（推荐，零运维）

文件已就绪：`.github/workflows/data-update.yml`（每 4 小时 + 手动 `workflow_dispatch`）。

### 启用步骤
1. 把本仓库推到 GitHub（见下方「推送命令」）。
2. 仓库 → **Settings → Secrets and variables → Actions → New repository secret**，添加：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - （可选）`AI_API_KEY` / `AI_API_URL` / `AI_MODEL`
3. 首次手动触发一次：仓库 → **Actions → Mercator Data Update → Run workflow**。
4. 之后每 4 小时自动跑；调度时间为 UTC `15 */4 * * *`（即北京 03:15 / 07:15 / 11:15 / 15:15 / 19:15 / 23:15）。

### 推送命令（仓库初始化已完成，仅差 remote）
```bash
cd D:/AI工具/mercator-main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```
> 若使用 GitHub 连接器：在左侧连接器面板连接 GitHub 后，可用 `gh` 创建仓库并推送；当前环境 `gh` 未安装、连接器断开，故需你提供仓库 URL 或先连接。

### 说明
- workflow 仅采集 `policies` / `rules` 并重新合并（countries/platforms/alerts 由本地 JSON 直接同步），最终 5 个 key 全部 upsert 到 `market_data`。
- 若 `data/` 有变化会自动 commit 回仓库；Supabase 落库在采集脚本内完成。

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
- [ ] `python scripts/collect_data.py --sync-only` 后，线上 `market_data` 含 5 个 key（countries/platforms/policies/rules/alerts）
- [ ] 定时触发后，Supabase `market_data.updated_at` 出现新时间戳
- [ ] SPA 中 `JAY_REFRESH_DEMO` 在生产环境设为 `false`，使 2h 周期刷新真正套用实时数据

## 常见坑

1. **git remote 为空 → GitHub Actions 实际不跑**：本机需先 `git remote add` 并 push，workflow 才会触发。
2. **service key 绝不写进仓库**：仅放 GitHub Secrets / 本机环境变量 / Supabase Secrets。
3. **CSP 放行 CDN**：`index.html` 的 CSP 须含 `script-src ... https://cdn.jsdelivr.net`，否则 supabase-js 被拦截、登录/同步失效（已处理）。
4. **演示模式**：`JAY_REFRESH_DEMO=true` 时周期刷新走演示演进、不套实时数据；正式上线改 `false`。
