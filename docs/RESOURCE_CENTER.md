# 资源中心

资源中心由三个目录组成：市场资料库、AI 智能体中心和观海学院。目录元数据保存在
`resource_items`，每次换版写入 `resource_versions`，文件索引写入 `resource_files`，标签
关系写入 `resource_item_tags`，访问统计写入 `resource_access_logs`。
观海学院的个人学习状态写入 `resource_learning_progress`，按用户和当前工作区隔离。

## 访问规则

- `public` 资源可以出现在登录用户目录中，但文件仍保存在私有 `resources` Storage bucket，下载时由 `resource-library` 签发 1 小时短链接。
- `workspace` 资源只对指定工作区的活跃成员可见。
- `restricted` 资源只对平台管理员可见，版权受限资料不得生成公开 URL。
- 草稿和已归档资源不进入普通用户目录；管理员可以查看并维护它们。
- 浏览器和公开页面永远不会读取或展示 `storage_path`。

## 管理流程

1. 管理员在资源中心新建资源并填写标题、类型、范围、年份、来源和访问级别。
2. 保存后可选择文件。页面先向 `resource-library` 请求一次性上传路径，再通过登录态上传到私有 bucket，最后登记文件元数据。
3. 换版使用 `create_version` 创建递增版本，不覆盖旧版本；新文件通过 `register_file` 关联到新版本。
4. 发布和下架分别记录为 `published`、`archived`，所有浏览和下载进入访问日志。

## 使用范围

- 市场资料库、AI 智能体中心和观海学院共用关键词、市场、平台、年份和类型筛选；正式目录和演示目录使用相同的渲染规则。
- 学院中的课程、课程单元和课程资料都作为资源条目维护。登录用户可以在课程卡片上更新自己的学习进度，管理员可以通过资源编辑和版本流程替换内容。

## 观海学院

- `courses`、`course_modules` 和 `course_lessons` 保存课程目录、章节与课时，管理员可以调整排序并发布课程新版本。
- `course_enrollments` 记录公开、工作区、单独购买或人工授权；`lesson_progress` 保存播放位置和完成状态，用户换电脑后仍从服务端恢复。
- `course_assignments`、`course_quizzes`、`course_favorites` 和 `course_lesson_resources` 分别承载作业、测验、收藏和课件关系。
- 视频不进入 GitHub，也不进入数据库大字段。管理员上传到私有 `academy-media` bucket，用户播放前由 `resource-library` 校验课程权限并签发 15 分钟地址。播放器从 `lesson_progress.last_position_seconds` 恢复位置，并在播放中、暂停和结束时把进度同步到服务端。
- 课件上传到私有 `resources` bucket，通过 `course_lesson_resources` 绑定课时；每次下载都重新校验课程权限并签发短期地址。
- 课程智能体只能使用当前用户已获授权的课程内容；课程目录中的 `course_assistant` 路由不得绕过 `can_access_course` 权限检查。

## 部署

迁移链新增 `20260926000000_resource_center.sql`、`20260927000000_resource_learning.sql` 和 `20260928000000_academy.sql`，并部署 JWT 保护的
`supabase/functions/resource-library`。生产环境的 `ALLOWED_ORIGINS` 只能包含正式站点，
Storage bucket `resources` 必须保持 `public = false`。发布前运行 `npm test` 和 Deno 类型检查。
