# 2026-09-18 Git 历史隐私清理记录

## 状态

- 项目 18 已完成：99 条清理路径已逐条分类，机器可读清单见 `history_cleanup_inventory_2026-09-18.json`。
- 项目 19 的 8 个远端分支已完成重写和原子强制更新；GitHub 服务器管理的旧 Pull Request 引用仍待 GitHub Support 清除。
- 项目 20 的全部远端分支、标签和其可达 blob 已复扫通过；包含 `refs/pull/*` 的服务器全引用复扫仍会发现 36 条受限路径，因此不能把 GitHub 全站历史标记为已彻底清除。

## 清理对象与影响

| 分类 | 数量 | 影响 |
| --- | ---: | --- |
| 同步日志 | 68 | 可能包含来源诊断和运行细节，只能保留在私有存储。 |
| 原始、中间和运行数据 | 10 | 不属于批准公开的正式投影，可能包含详细来源数据。 |
| 基线和隔离数据 | 4 | 可能包含未验证、未来日期或已被替换的记录。 |
| 美国品类私有数据 | 8 | 完整品类数据为服务私有，只允许提交批准后的公开投影。 |
| 旧 PDF | 9 | 二进制报告导出不在公共仓库白名单内。 |
| **合计** | **99** | 路径名和分类被保留用于审计，文件内容不得重新提交。 |

完整清单不包含文件内容、密钥值或原始数据，只记录路径、分类和命中原因。

## 备份与重写

最终重写基于 2026-09-18 12:50:42 +08:00 捕获的远端状态，已在仓库外创建 bare mirror 和完整 bundle：

```text
C:\Users\15961\Documents\ChatGPT\Jay观海\mercator-history-backups\20260918T125042+0800\
```

bundle SHA-256：

```text
28789A3CA07DBDFFC6A6785C0BA8EF324AB4C544B08F29D0F7E23883902FDFA2
```

使用 `git-filter-repo 2.47.0 --sensitive-data-removal --invert-paths` 重写 99 条路径。推送前已对分支和当时可见的 Pull Request 引用执行全量对象扫描：1,735/1,735 个 blob 已读取，受限路径、密钥和扫描错误均为 0。

| 分支 | 重写前 | 重写后 |
| --- | --- | --- |
| `codex/product-redesign` | `ed77fe83141e5f8cae6cefb6e7468319abf12cfc` | `720c564eccae3443f97968a8d0fa5135243ebbe9` |
| `codex/production-backend-readiness` | `65e8fabbf36e815e9cf3fd84d731dae66ab2ab82` | `7135a42e6f9451d67d957ed38c309a87401a2c9c` |
| `demo` | `133ef2e535a8cc007c81452a30f1b9402aeecff3` | `d26f8f1dfc064d82ac84a630d51d67dd52733e34` |
| `dev` | `af70692b39b9d67384db5ceb24542469a2c8beb1` | `10c36f76f94c2a709f32db3b4f441e29f86adda6` |
| `feat/data-pipeline-v2` | `5d4bbb66415f8b2603729e1c13f4799e33d921ad` | `886d0305bfdde8f3d7a618087089f527f7d87de2` |
| `feat/ui-redesign-v3` | `18a122756dee04b1fe43118bfc0f188ef33a839d` | `b545dbd0e494fec0a717ddbf5e71c40ee3e35ed0` |
| `fix/login-csp-auth` | `df1c1d48b4404dae1ceb5c7878a8c59622943c2d` | `5da7e7842ab861fb18fbe49e460b9ff6c44ff7bf` |
| `main` | `07729e2fb001495b1470aa76ff986abd9975f6c9` | `2f1813a44ce2bce58e908be3187ad6bcfc8cc881` |

8 个分支使用逐分支 `--force-with-lease` 在一次原子推送中更新；远端没有标签。

## 远端复扫

从 GitHub 新建只抓取 `refs/heads/*` 和 `refs/tags/*` 的裸验证仓库后，结果如下：

| 指标 | 结果 |
| --- | ---: |
| 远端分支 | 8 |
| 远端标签 | 0 |
| 历史路径 | 401 |
| 可达 blob / 已扫描 blob | 1,729 / 1,729 |
| 受限路径 | 0 |
| 高置信度密钥 | 0 |
| 扫描错误 | 0 |

可复现命令：

```bash
git init --bare mercator-history-audit.git
git --git-dir=mercator-history-audit.git remote add origin https://github.com/lidengrong3-prog/mercator.git
git --git-dir=mercator-history-audit.git fetch --prune origin \
  '+refs/heads/*:refs/heads/*' '+refs/tags/*:refs/tags/*'
python scripts/history_privacy_scan.py \
  --root mercator-history-audit.git \
  --output history-privacy-report.json \
  --require-clean
```

也可手动运行 GitHub Actions 的 `History privacy audit` 工作流。

## GitHub Pull Request 引用残留

GitHub 的 `refs/pull/1/head` 至 `refs/pull/13/head` 是服务器管理的只读引用，普通 `git push` 不能改写。 fresh mirror 的全引用扫描读取 2,043/2,043 个 blob，密钥和扫描错误为 0，但旧 PR 历史仍命中 36 条受限路径。提交 `80842915de8dc8de69b8c8eef94f5da5dee759a3` 中的受限路径已通过按 SHA 直接抓取验证为仍可读取。

仓库管理员必须向 GitHub Support 提交敏感数据清除请求，并提供：

- 仓库 `lidengrong3-prog/mercator`；
- `git-filter-repo` 报告的 First Changed Commit：`a53f47c20f9223786b7415794794f7c56dae866b`；
- 受影响的 Pull Request 编号 1 至 13；
- 可复现的残留提交 `80842915de8dc8de69b8c8eef94f5da5dee759a3`；
- 请求清除旧 PR refs、缓存 diff 和服务器端不可达对象。

Support 完成后，必须再次执行全镜像扫描，并确认受限路径 0、密钥 0、扫描错误 0，且上述旧提交 SHA 无法抓取，才能关闭项目 19 的旧哈希验收和项目 20 的服务器全引用验收。

## 协作者重新克隆

所有旧克隆都包含重写前对象，不能继续 pull、merge、rebase 或 push。协作者应停止使用旧目录，重新克隆：

```bash
git clone https://github.com/lidengrong3-prog/mercator.git mercator-clean
cd mercator-clean
git rev-parse HEAD
python scripts/repository_privacy_check.py
```

未推送工作不能直接从旧分支 merge 或 cherry-pick。先导出并人工审查代码差异，只把确认不含 99 条受限路径和原始内容的修改重新应用到新克隆。CI、部署平台和机器人使用的持久 clone 也必须删除并重新创建。
