# 数据源登记与授权台账

## 目的

生产采集器只能访问已经登记且仍处于可采集状态的数据源。来源的公开属性保存在 `data_source_registry`，合同、价格、授权和字段边界保存在仅 service role 可读的 `data_source_access_policies`。原始响应继续写入私有 `raw_data_records` 或 `private-raw-data` Storage，不能写入公开仓库。

## 来源分类

- `official_policy`：政府政策、法规和监管记录。
- `official_statistics`：政府或官方统计 API。
- `platform_announcement`：平台规则、公告和卖家中心记录。
- `industry_media`：行业媒体与行业协会，只作为待核验线索。
- `third_party_provider`：TikHub 等商业数据服务商。
- `user_upload`：工作区成员上传的资料。
- `derived`：由正式记录计算或聚合的数据。
- `internal`：采集日志、质量报告、备份等内部运行数据。
- `demo`：测试或演示数据，生产禁用。

前端从正式记录的 `source_category` 展示来源类别，不再根据来源名称猜测。来源授权表不会下发给匿名浏览器。

## 台账字段

`data_source_registry` 保存来源 key、名称、主体、官网、来源类别、官方/第三方类型、权威层级、可信等级、市场、平台、品类、更新频率、核验策略、复核时间和启停状态。

`data_source_access_policies` 保存许可类型、访问级别、商业使用权、再分发权、授权状态和有效期、API 计价、速率限制、保留期限、允许存储/展示/导出的字段、署名要求、条款 URL 和所需 Secret 名称。

台账不保存 API Key、合同原文、供应商原始响应或用户数据。API Key 只能保存在 GitHub/Supabase Secrets。

## 采集和发布规则

1. `.github/workflows/data-update.yml` 在采集前调用 `refresh_source_registry_status()`，把过期授权或超期未复核来源标为 `expired` 并停止采集。
2. 工作流把最新台账下载到 runner 临时目录，并设置 `SOURCE_GOVERNANCE_FILE`。该文件不会进入仓库或 Actions 产物。
3. 每个采集器在第一次 HTTP 请求前调用 `assert_source_collectable()`。未知、停用、暂停、过期、撤销或超期未复核来源不会发起请求。
4. `source_is_publishable()` 只允许授权为 `confirmed/not_required`、允许商业使用、允许再分发、允许公开摘要且有展示字段白名单的官方政策、官方统计和平台公告进入正式投影。
5. 未确认授权的来源仍可按授权边界采集到私有证据层，但写入时强制设置 `publication_status=quarantined`。
6. `market_data_applicability` 的触发器再次执行服务端校验，绕过脚本直接写库也不能把隔离来源发布出去。
7. AI 报告拒绝 `quarantined/blocked` 记录，以及授权为 `pending/expired/revoked` 的第三方或行业来源。

## 新增来源流程

1. 先在 `scripts/source_governance.py` 和新的有序迁移中登记来源，不要先写采集器。
2. 明确主体、URL、类别、市场/平台/品类、可信等级、更新频率和复核日期。
3. 审核服务条款，登记价格、速率限制、保留期限、字段白名单、商业使用和再分发权限。
4. 第三方来源在合同或条款未确认前使用 `authorization_status=pending`，并保持 `redistribution_allowed=false`。
5. 把密钥名称登记到 `authorization_secret_name`，实际密钥只写入部署 Secrets。
6. 运行 `python scripts/validate_source_registry.py`，确认采集器引用的所有 `source_key` 均有台账记录。
7. 通过安全评审后，才可以把授权改为 `confirmed`；是否允许正式页面仍由商业使用、再分发、用途和字段白名单共同决定。

## TikHub 当前状态

TikHub 已登记为 `third_party_provider`，默认授权状态为 `pending`，原始响应保留 30 天，密钥名为 `TIKHUB_API_KEY`，禁止公开再分发和报告导出。完成套餐、接口用途和商业展示条款确认后，必须单独更新生产台账；不能仅因为 API 调用成功就开放公开展示。

## 运维检查

本地或 CI 执行：

```bash
python scripts/validate_source_registry.py
python scripts/validate_migration_chain.py
python -m unittest discover -s tests -p "test_source_governance.py"
```

生产 runner 获取实时台账：

```bash
python scripts/validate_source_registry.py --export-runtime "$RUNNER_TEMP/source-governance.json"
```

不要在开发机把生产 service role key 写入命令历史或仓库文件。生产迁移和 Edge Function 部署仍通过正式发布工作流执行。
