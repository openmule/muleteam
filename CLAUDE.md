# MuleTeam 项目级开发原则

> 来源：Thread xc0aismg1pf6 团队讨论共识，经 Cheng 确认

## 核心产品哲学

### 1. Agent 即功能（New Agent = New Feature）

**这是 MuleTeam 最核心的设计原则。**

传统 SaaS：需要新功能 → 写代码 → 发版 → 用户学习。6 个月。
MuleTeam：需要新功能 → 加一个 Agent → 它自己开始工作。6 分钟。

- 不在 SaaS 里堆功能模块，而是提供通用 building blocks + 让 Agent 成为功能载体
- 工程投入集中在 platform primitives（消息、文件、任务、标签），不做 domain features
- 新功能的边际成本趋近于零（写一个 Agent 比写一个 feature 便宜 10 倍）

### 2. 加功能 = 加 Agent，基础功能保持正交且 minimal

**判断标准：如果一个功能可以用「一个 Thread + 一个 Agent」解决，就不要改底层 API。**

实例：
- Team Context → 用一个 Team Context Thread 收集，不改基础设施
- Channel Rules → 每个 Channel 有一个 Channel Rule Thread，不加 Channel Spec 层
- Decision Log → DECISION_LOG.md 文件 + secretary Agent 维护，不做成产品 feature
- Thread Summary → README.md + Agent 自动生成，不做专门功能

基础层（Thread、Message、File、Action Item、Agent）保持正交、最小化。

### 3. 会议室类比（Thread = War Room）

Thread 内的 building blocks 已经足够：
- **Thread** = 会议室 / war room
- **Messages** = 对话
- **Files (workspace)** = 桌上的纸笔文件（含约定文件 README.md、DECISION_LOG.md）
- **Action Items** = 白板上的任务卡片

不要往会议室里装打印机、咖啡机然后叫它「会议室 Pro」。给人笔和纸，让他们自己决定怎么用。

### 4. Building Blocks 优先

CLI、API、Workspace 对 Agent 必须足够友好——这是「Agent 即功能」的前提。

- Agent 需要高效获取 thread 全量上下文（export/snapshot）
- workspace 文件读写必须完整（read/write/delete）
- 能力标签（tags）让 Agent 可被发现和匹配任务

## 商业模式原则

### 5. 产品套件不捆绑（Suite, Not Bundle）

- **MuleRun**（toC）：个人 AI Agent 运行平台，按用量付费
- **MuleTeam**（toB）：人机混编协作平台，团队订阅 + Agent Credits
- 独立品牌、独立定价、独立验证 PMF
- 共享账户体系，Agent Credits 底层 = MuleRun 运行时，自然 cross-sell

### 6. 开源 vs 商业：便利性差异化，非功能差异化

- 自带 Agent（BYOA）= 完整功能，用户自己管 infra 和 LLM key
- Hosted Agent = 同样功能 + 零运维（我们管 infra、LLM、沙箱）
- **绝不能**在开源版里故意做差某些功能来逼转化
- 开源版体验 > Hosted 免费版（member 数量/存储限制在开源版是可配置项，无刚性约束）

### 7. SaaS 订阅是获客工具，Agent Credits 是利润中心

- $20/team（非 per-seat）→ 极低门槛，建立付费关系
- Agent Credits（pay-as-you-go）→ 真正的 revenue engine
- 按「agent 工作单元」定价，不按 token 转售（模糊底层成本，符合用户心智）

## 技术原则

### 8. 渐进式架构

- 初期保持单实例，不过早引入分布式复杂度
- Git 存储在初期完全够用，水平扩展时再迁移
- 技术上按 Phase 2 架构建 Phase 1（留好扩展点），产品上只讲 Phase 1 故事

### 9. 技术乐观，产品保守

- 技术架构预留扩展点（agent 调度、usage-based billing）
- 产品和市场上只承诺已验证的能力
- 先证明核心假设（有人愿意付费），再用数据决定投什么

### 10. Async-first, Real-time-capable

- 异步是核心设计，实时是性能优化
- Agent 的工作模式是轮询（CLI poll），不依赖实时推送
- 人类侧可以后续加 SSE 做实时消息流，但不是 V1 优先

## 开发行为准则

- 改动 MuleTeam 前，在 MuleTeam thread 里讨论（dogfooding）
- 不要把 roadmap 当 feature wishlist 管理——先证明核心假设，再用数据决定投什么
- V2 内容由 V1 的真实数据决定，不是现在排好的 feature list
- 用户反馈驱动的改进 > 自己想出来的新功能
