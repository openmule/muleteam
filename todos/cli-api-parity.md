# CLI 补全计划 — 对齐 API 能力

> 目标：让 Agent 通过 CLI 能完成所有核心协作动作，支撑"Agent 即功能"路线。
> 按优先级分批交付，每批可独立上线。

---

## P0 — Agent 工作闭环必备

这些缺失直接影响 Agent 自主完成任务的能力。

### 1. `thread-update <id> --status <status> [--description "..."] [--labels l1,l2]`
- 对应 API：PATCH /api/threads/[id]
- 为什么重要：Agent 完成工作后需要标记 thread 为 done/in_progress，当前只能靠人手动改
- 实现要点：支持 `--status open|in_progress|done|archived`、`--description`、`--labels` 三个 flag

### 2. `file-delete <id> <path>`
- 对应 API：DELETE /api/threads/[id]/workspace/[path]
- 为什么重要：已有 read/write，缺 delete 导致 Agent 无法管理 workspace 文件生命周期
- 实现要点：一行 curl，加确认提示（`--force` 跳过）

### 3. `mark-read [--all] [event-id...]`
- 对应 API：POST /api/events/read-all 或 PATCH /api/events/[id]
- 为什么重要：poll 拿到事件后无法标记已读，下次 poll 重复出现，Agent 处理逻辑会混乱
- 实现要点：`mark-read --all` 全部已读；`mark-read <id>` 单条已读

---

## P1 — 团队管理自助化

Agent 或管理员通过 CLI 完成团队日常管理，减少 UI 依赖。

### 4. `invite [--list] [--create] [--revoke <token>]`
- 对应 API：GET/POST/DELETE /api/invites/*
- 场景：Agent 自动生成邀请链接发给新成员
- 实现要点：
  - `invite --list` 列出现有邀请
  - `invite --create [--note "..."]` 创建邀请（返回链接）
  - `invite --revoke <token>` 撤销邀请

### 5. `thread-leave <id>`
- 对应 API：DELETE /api/threads/[id]/join
- 场景：Agent 完成阶段性工作后退出 thread，保持参与列表干净

### 6. `thread-add-member <id> <member-name>`
- 对应 API：POST /api/threads/[id]/participants
- 场景：Agent 发现需要其他人/Agent 协助时，主动拉人进 thread

### 7. `thread-move <id> --channel <channel-id>`
- 需新建 API：PATCH /api/threads/[id] 增加 `channel_id` 字段支持（当前 PATCH 不支持改 channel）
- 对应 CLI：`thread-move <id> --channel <channel-id>`，传 `--channel none` 移出所有 channel
- 场景：Thread 归类调整，比如从"杂项"移到"sprint-3"频道，或 Agent 自动将完成的 thread 归档到特定 channel
- 实现要点：
  - API 层：PATCH /api/threads/[id] 的 body 增加可选 `channel_id` 字段，写入 meta.json
  - CLI 层：一行 curl 调用 PATCH，支持 `--channel <id>` 和 `--channel none`

### 8. `channel-create "name" [--description "..."]`
- 对应 API：POST /api/channels
- 场景：按项目/主题组织 thread 的前提

---

## P2 — 完善体验，按需实现

优先级较低，有了更好但不阻塞核心流程。

### 9. `task-update <thread-id> <task-id> [--assignee @name] [--description "..."]`
- 对应 API：PATCH /api/threads/[id]/tasks/[taskId]
- 当前 task-done 只能改状态，不能改指派人或描述

### 10. `links <id> [--add <url> --title "..."]`
- 对应 API：GET/POST /api/threads/[id]/links
- 场景：Agent 把参考资料链接挂到 thread

### 11. `upload <id> <file-path>`
- 对应 API：POST /api/threads/[id]/images
- 场景：Agent 上传截图、生成的图表等

### 12. `unread-count`
- 对应 API：GET /api/events/count
- 场景：快速检查有无待处理事项，比 poll 更轻量

---

## 不做（管理性操作留给 UI）

以下 API 能力不计划暴露到 CLI，原因是使用频率极低或有安全顾虑：

- Thread pin/unpin — 低频，UI 操作更直观
- Thread delete — 破坏性操作，应在 UI 二次确认
- Agent delete / regenerate-token — 敏感操作
- User role 管理 — Owner 专属，UI 更安全
- Webhook 配置 — 一次性设置，UI 足够
- Channel update/delete — 低频管理操作
- Artifact 版本/预览 — 面向人类的浏览功能
