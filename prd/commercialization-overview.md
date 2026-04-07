# MuleTeam 商业化全景分析

> 日期：2026-03-30
> 状态：Draft — 供团队讨论排优先级
> 部署模式：共享多租户 SaaS（单 Next.js 实例，per-tenant DB + Git 存储）

---

## 1. 产品定位与商业模式

### 1.1 产品套件（Suite）模式

MuleTeam 不是一个孤立产品，而是 Mule 产品家族的 toB 端：

| 产品 | 定位 | 目标用户 | 商业模式 |
|------|------|---------|---------|
| **MuleRun** (mulerun.com) | 个人 AI Agent 运行平台 | 个人用户 (toC) | 按用量付费 |
| **MuleTeam** | 人机混编协作平台 | 企业团队 (toB) | 团队订阅 + Agent 订阅 |

两者关系：**独立品牌、独立定价、共享账户体系**。MuleTeam 的 Hosted Agent 底层跑在 MuleRun 运行时上。类比 Atlassian（Jira / Confluence / Bitbucket）。

> 参考讨论：Thread xc0aismg1pf6 — Lelouch 和 muleteam-pm 的分析

### 1.2 收入线

**A. 团队订阅** — 按团队收费（可含席位梯度）

| 套餐 | 说明（示例） |
|------|------------|
| Free | 有限成员数、有限 Thread、基础功能 |
| Pro | 更多成员、更多存储、高级功能 |
| Enterprise | 无限制、SLA、专属支持、SSO |

**B. Agent 订阅** — 第一方 Agent 按月订阅

- 平台提供一批官方 Agent（如 mule-secretary、code-reviewer 等）
- 团队按需订阅，订阅后 Agent 自动注册到团队
- Agent 底层运行时 = MuleRun 额度，自然形成产品 cross-sell

---

## 2. 平台层（Control Plane）— 需要新建

当前 MuleTeam 只有"产品本体"（协作功能），缺少管理租户的平台层。

### 2.1 团队注册 & Provisioning

```
用户注册 → 创建团队 → 自动化 Provisioning:
  1. 通过 Neon API 创建独立数据库
  2. 初始化 Git 存储目录 (tenants/{slug}/)
  3. 运行 DB migration
  4. 生成 team slug + subdomain
  5. 种子数据（欢迎 Thread、默认 Channel）
```

### 2.2 平台级用户系统

**现状**：每个租户的 `users` 表独立，不存在跨租户的用户概念。

**需要**：一个**平台级数据库**，存储：
- 平台用户（email → 可属于多个团队）
- 团队元数据（slug、套餐、创建时间、状态）
- 订阅记录（Stripe Customer ID、Subscription ID）
- Agent 市场目录（官方 Agent 列表、定价）

### 2.3 团队生命周期

| 状态 | 触发条件 | 行为 |
|------|---------|------|
| active | 正常付费 | 完整服务 |
| trial | 新注册 | 限时免费体验 |
| past_due | 欠费 | 宽限期（如 7 天），发提醒 |
| suspended | 欠费超宽限期 | 只读模式，不能创建新 Thread |
| cancelled | 主动取消或长期欠费 | 数据保留 N 天后清理 |

### 2.4 平台 Admin Dashboard

你们内部用来：
- 查看所有客户、团队状态、使用量
- 手动操作（延长试用期、调整套餐、处理工单）
- 业务指标监控（MRR、churn、活跃团队数）

---

## 3. 计费系统（Billing）— 需要新建

### 3.1 Stripe 集成

| 能力 | 说明 |
|------|------|
| Customer 管理 | 团队注册时创建 Stripe Customer |
| Subscription | 团队订阅（按套餐）+ Agent 订阅（按 Agent） |
| Webhook 处理 | 监听 `invoice.paid`、`invoice.payment_failed`、`customer.subscription.updated` 等 |
| 支付方式 | 信用卡（Stripe Checkout 或 Elements） |
| 发票 | Stripe 自动生成 |
| 席位变更 | 添加/移除成员时同步更新 Subscription quantity |

### 3.2 Agent 市场

| 能力 | 说明 |
|------|------|
| Agent 目录 | 展示官方 Agent（名称、描述、能力标签、定价） |
| 订阅管理 | 团队选择订阅/退订 Agent |
| 自动安装 | 订阅后自动将 Agent 注册到团队（调用 /api/agents/register） |
| 用量追踪 | 如果 Agent 按调用量计费，需要 metering |

---

## 4. 后端改造

### 4.1 现有代码需调整的部分

| 领域 | 现状 | 改造内容 |
|------|------|---------|
| **认证** | 每个租户独立 users 表 + JWT | 增加平台级认证层：登录一次，切换团队无需重新登录。subdomain 间 cookie 共享（当前有 blocker） |
| **租户隔离** | `x-team-slug` + ALS 机制 | 加固：per-tenant rate limiting、存储配额、API 调用限制 |
| **DB provisioning** | 手动配置 DATABASE_URL | 自动化：通过 Neon API 按需创建/删除数据库 |
| **权限** | owner / member 两级 | 可能需要 RBAC：admin / editor / viewer |
| **API 安全** | 基本认证检查 | rate limiting、audit log、API key 管理 |
| **CLI** | 基础命令已有 | 补全 building block：export/snapshot、workspace 文件读写命令（对"Agent 即功能"至关重要） |

### 4.2 Git 存储 — 最大的技术风险点

**现状**：Thread/消息存储在本地 Git 裸仓库，单机文件系统。

**问题**：商业化后水平扩展时，多个 Next.js 实例需要共享文件系统。

**可选方案**（按实施难度排序）：

| 方案 | 优点 | 缺点 | 适用阶段 |
|------|------|------|---------|
| 保持单实例 + 垂直扩展 | 零改动 | 有上限 | 初期 (< 100 团队) |
| NFS / EFS 共享存储 | 改动小 | 性能瓶颈、单点故障 | 中期 |
| Git 存储迁移到 DB + 对象存储 | 彻底解决 | 大量改造 | 长期 |

**建议**：初期保持单实例，优先做业务层。当团队数量增长到需要水平扩展时再迁移。

---

## 5. 前端改造

| 页面/功能 | 现状 | 改造内容 |
|-----------|------|---------|
| **Landing Page** | 无 | 产品官网：价值主张、功能介绍、定价页、注册入口 |
| **注册/登录** | 简单 email + password | 平台级注册（可加 Google OAuth）→ 创建/加入团队 |
| **团队切换** | 已有 PLATFORM_MODE team switcher | 完善：切换时刷新上下文、显示当前套餐 |
| **Billing UI** | 无 | 套餐选择、支付页面（Stripe Checkout）、账单历史、席位管理 |
| **Agent 市场** | 无 | 浏览 Agent 目录、订阅/退订、查看能力标签和用量 |
| **Settings** | 基础 | 扩展：团队信息、Billing、成员权限、API Key 管理 |
| **Onboarding** | 有欢迎 Thread | 加强引导流程：邀请成员 → 浏览 Agent 市场 → 创建第一个 Thread |

---

## 6. 基础设施（Infra）

| 领域 | 说明 |
|------|------|
| **域名路由** | `{team}.mule.run` 或 `app.mule.run`（反向代理注入 x-team-slug / x-tenant-database-url headers）。当前有 subdomain auth cookie domain 的 blocker 待修复 |
| **容器化** | 当前 PM2 + SSH 部署 → Docker 化 + 编排（K8s / Fly.io / Railway） |
| **监控** | 应用级：错误追踪（Sentry）、性能监控。业务级：活跃团队、消息量、Agent 调用量 |
| **备份** | PostgreSQL：Neon 自带 PITR。Git 存储：定期备份到 S3/R2 |
| **安全** | HTTPS、WAF、DDoS 防护、数据传输加密、安全审计 |
| **合规** | 隐私政策、服务条款、数据处理协议（DPA）、GDPR（如面向欧洲市场） |

---

## 7. 优先级建议

### P0 — 必须有才能收费

> 没有这些就无法开始商业化

1. **平台层基础**：团队注册 + 自动 provisioning（Neon API 创建 DB + 初始化 Git）
2. **平台级认证**：一个账号多个团队、subdomain cookie 共享修复
3. **Stripe 集成**：团队订阅收费（Checkout + Webhook）
4. **Billing UI**：套餐选择 + 支付 + 管理
5. **Landing Page**：产品官网 + 定价页

### P1 — 上线后尽快补齐

> 有了能增强竞争力和用户体验

6. **Agent 市场**：官方 Agent 目录 + 订阅 + 自动安装
7. **Rate Limiting & 配额**：per-tenant API 限速、存储限额
8. **监控 & 告警**：Sentry + 业务指标
9. **CLI 补全**：export/snapshot 命令、workspace 文件操作（"Agent 即功能"基础）
10. **Onboarding 流程**：引导新用户快速上手

### P2 — 规模化后需要

> 当团队数量增长到一定规模

11. **Git 存储迁移**：解决水平扩展问题
12. **容器化部署**：Docker + 编排
13. **细粒度 RBAC**：admin / editor / viewer
14. **Admin Dashboard**：内部运营后台
15. **合规体系**：隐私政策、DPA、GDPR
16. **MuleRun 集成**：共享账户体系、Agent Credits 互通

---

## 8. 与现有架构的兼容性评估

| 现有能力 | 商业化可复用度 | 备注 |
|---------|-------------|------|
| 多租户 ALS + header 隔离 | **高** | 核心机制已就位，需加固 |
| JWT + Bearer Token 认证 | **中** | 可复用，但需增加平台级层 |
| Platform Mode (team switcher) | **高** | 已有基础，需完善 |
| Git 存储 | **中** | 单机可用，扩展是瓶颈 |
| 邀请系统 | **高** | 可直接用于商业版 |
| 事件/通知系统 | **高** | 可直接复用 |
| Webhook 系统 | **高** | 可直接复用 |
| i18n（中英双语） | **高** | 商业化必备 |

---

## 附录：关键设计原则

来自团队讨论的共识（Thread xc0aismg1pf6）：

1. **Agent 即功能**：新功能通过新 Agent 实现，而非在平台上堆功能。平台保持 building blocks 简单通用。
2. **Building blocks 优先**：确保 CLI、API、Workspace 对 Agent 足够友好，这是"Agent 即功能"的前提。
3. **产品套件不捆绑**：MuleRun 和 MuleTeam 独立品牌、独立定价、独立验证 PMF。通过共享账户和 Agent Credits 自然形成 cross-sell。
4. **渐进式架构**：初期保持单实例，不过早引入分布式复杂度。在需要时再迁移。

---

## 9. 产品优化方向：层级化 Context/Spec 体系

### 现状

当前产品上下文是扁平的，只有 Thread 级别有 workspace 文件（README.md + DECISION_LOG.md）。Channel 和 Team 没有任何规范或上下文机制。唯一的"继承"是 Channel 成员自动加入 Thread、Channel 成员拥有 Thread 访问权限。

### 问题

- Agent 参与协作时缺乏团队级和频道级的背景知识，每个 Thread 都要重复交代上下文
- 无法在 Channel 层面定义工作流规范（如"这个频道的 Thread 完成后必须产出 XXX"）
- 团队级的协作规则（如命名规范、沟通风格、决策流程）无处承载

### 建议方案：三级 Spec 继承

```
Team Spec （团队级）
  → 协作规则、角色定义、全局约定、品牌/风格指南
  → 存储：Git 根目录下 team-spec.md 或 team/spec.json

  └── Channel Spec （频道级）
        → 该频道的主题定义、工作流、输出标准、模板
        → 存储：channels/{id}/spec.md
        → 继承 Team Spec，可覆盖或补充

        └── Thread Context （Thread 级，已有）
              → 具体讨论的上下文、决策记录
              → 存储：threads/{id}/workspace/README.md（已有）
              → 继承 Channel Spec + Team Spec
```

### 关键行为

1. **创建 Thread 时**：自动将 Channel Spec + Team Spec 注入为初始上下文，Agent 可直接感知上层规范
2. **Agent 加入 Thread 时**：CLI `export` 命令输出应包含完整的 spec 继承链
3. **Spec 变更时**：不追溯更新已有 Thread，仅影响新创建的 Thread（避免复杂度）

### 商业价值

- 差异化卖点：团队可以通过 Spec 定义"组织知识"，Agent 天然继承，无需反复 prompt
- 付费点：高级套餐支持多级 Spec + 自定义模板
- 对 "Agent 即功能" 的增强：Agent 在任何 Thread 中都能获取完整的组织上下文，行为一致性更好
