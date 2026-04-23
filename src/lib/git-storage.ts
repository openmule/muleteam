import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getRepoPath } from "./tenant-context";

const DEFAULT_REPO_BASE = process.env.GIT_REPO_PATH || path.join(process.cwd(), ".data", "repo");

function REPO_BASE(): string {
  return getRepoPath() || DEFAULT_REPO_BASE;
}

// ── Per-thread repo layout ──
// Global data (channels, agents): .data/repos/global/
// Per-thread repos:               .data/repos/threads/{threadId}/
//
// Each thread repo contains flat paths:
//   meta.json, messages.jsonl, tasks.json, links.json,
//   artifacts/, workspace/

function REPOS_ROOT(): string {
  const base = REPO_BASE();
  // New layout: sibling "repos" dir next to legacy "repo" dir
  // If REPO_BASE points to .data/repo, repos root is .data/repos
  // If REPO_BASE is custom (tenant), use <base>/repos
  if (base.endsWith("/repo") || base.endsWith("\\repo")) {
    return base.slice(0, -"/repo".length) + path.sep + "repos";
  }
  return path.join(base, "repos");
}

function GLOBAL_REPO_DIR(): string {
  return path.join(REPOS_ROOT(), "global");
}

function THREAD_REPO_DIR(threadId: string): string {
  return path.join(REPOS_ROOT(), "threads", threadId);
}

// ── Per-thread git locks ──
// Each thread repo gets its own serialization lock so concurrent
// operations on different threads don't block each other.
const threadLocks = new Map<string, Promise<void>>();
const globalLock = { promise: Promise.resolve() };

async function withThreadLock<T>(threadId: string, fn: () => T): Promise<T> {
  const prev = threadLocks.get(threadId) || Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  threadLocks.set(threadId, next);
  await prev;
  try {
    return fn();
  } finally {
    resolve!();
  }
}

async function withGlobalLock<T>(fn: () => T): Promise<T> {
  const prev = globalLock.promise;
  let resolve: () => void;
  globalLock.promise = new Promise<void>(r => { resolve = r; });
  await prev;
  try {
    return fn();
  } finally {
    resolve!();
  }
}

// Legacy compat — wraps thread lock for callers that still use withGitLock
async function withGitLock<T>(fn: () => T): Promise<T> {
  // Fall back to global lock for backward compat (used only by workspace writes)
  return withGlobalLock(fn);
}

// Types
export interface ThreadMeta {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "done" | "archived";
  status_label?: string;
  status_detail?: string;
  labels?: string[];
  participants: Participant[];
  channel_id?: string;
  created_by?: string; // participant id of creator (e.g. "human:uuid" or "agent:id")
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

export interface Message {
  id: string;
  ts: number;
  from: string;       // "human:<user-id>" or "agent:<agent-id>"
  from_name: string;  // display name
  type: "text" | "artifact" | "system" | "activity";
  body: string;
  artifact_version?: number; // if type is "artifact", which version this created
  reply_to?: string;  // message id this is replying to
}

export interface ArtifactVersion {
  version: number;
  commit_hash: string;
  message_id: string;
  created_at: string;
  summary: string;
}

export interface HyperlinkEntry {
  id: string;
  url: string;
  title: string;
  type: "demo" | "reference" | "external";
  added_by: string;
  added_at: string;
}

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  token_hash: string;
  created_at: string;
  last_seen_at: string;
  created_by?: { id: string; name: string };
}

export interface WorkspaceFile {
  name: string;
  size: number;
  modified: string;
}

export interface ChannelMeta {
  id: string;
  name: string;
  description?: string;
  members: Participant[];
  created_by?: string; // participant id of creator
  created_at: string;
  updated_at: string;
}

// ── Git repo initialization ──

function initGitRepo(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(path.join(dir, ".git"))) {
    execSync("git init", { cwd: dir });
    execSync('git config user.email "system@muleteam.local"', { cwd: dir });
    execSync('git config user.name "MuleTeam System"', { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitkeep"), "");
    execSync("git add . && git commit -m 'init'", { cwd: dir });
  }
}

/** Initialize the global repo (channels, agents). */
function initGlobalRepo(): void {
  initGitRepo(GLOBAL_REPO_DIR());
}

/** Initialize a per-thread repo. Creates and git-inits if needed. */
function initThreadRepo(threadId: string): void {
  initGitRepo(THREAD_REPO_DIR(threadId));
}

/**
 * Public initRepo — ensures global repo exists and runs migration if needed.
 * Kept for backward compatibility with callers (e.g. seed route).
 */
export function initRepo(): void {
  initGlobalRepo();
  migrateIfNeeded();
}

export function clearRepo(): void {
  // Clear global data
  const globalDir = GLOBAL_REPO_DIR();
  for (const dir of ["channels", "agents"]) {
    const p = path.join(globalDir, dir);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
  }
  // Clear all per-thread repos
  const threadsRoot = path.join(REPOS_ROOT(), "threads");
  if (fs.existsSync(threadsRoot)) fs.rmSync(threadsRoot, { recursive: true });

  // Also clear legacy repo threads if still present
  const legacyThreads = path.join(REPO_BASE(), "threads");
  if (fs.existsSync(legacyThreads)) fs.rmSync(legacyThreads, { recursive: true });
}

// ── Migration from monolithic to per-thread repos ──

let migrationDone = false;

function migrateIfNeeded(): void {
  if (migrationDone) return;
  migrationDone = true;

  const legacyBase = REPO_BASE();
  initGlobalRepo();

  // Always check and migrate channels/agents from legacy repo to global repo
  let globalDataMigrated = false;
  for (const subdir of ["channels", "agents"]) {
    const legacyPath = path.join(legacyBase, subdir);
    const globalPath = path.join(GLOBAL_REPO_DIR(), subdir);
    if (fs.existsSync(legacyPath)) {
      // Copy files that don't exist in globalPath yet
      if (!fs.existsSync(globalPath)) {
        copyDirRecursive(legacyPath, globalPath);
        globalDataMigrated = true;
      } else {
        // Global dir exists but may be empty — copy individual files
        const legacyFiles = fs.readdirSync(legacyPath);
        for (const file of legacyFiles) {
          const src = path.join(legacyPath, file);
          const dst = path.join(globalPath, file);
          if (!fs.existsSync(dst) && fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dst);
            globalDataMigrated = true;
          }
        }
      }
    }
  }
  if (globalDataMigrated) {
    gitCommitInRepo(GLOBAL_REPO_DIR(), "Migrate global data from legacy repo", "MuleTeam System", "system@muleteam.local");
  }

  const legacyThreadsDir = path.join(legacyBase, "threads");
  if (!fs.existsSync(legacyThreadsDir)) return;

  // Check if there are thread directories in the legacy location
  const entries = fs.readdirSync(legacyThreadsDir).filter(d => {
    return fs.existsSync(path.join(legacyThreadsDir, d, "meta.json"));
  });

  if (entries.length === 0) return;

  // Migrate each thread to its own repo
  for (const threadId of entries) {
    const legacyDir = path.join(legacyThreadsDir, threadId);
    const newDir = THREAD_REPO_DIR(threadId);
    if (fs.existsSync(newDir) && fs.existsSync(path.join(newDir, "meta.json"))) {
      continue; // Already migrated
    }
    initGitRepo(newDir);
    // Copy all thread files to the new per-thread repo (flat layout)
    copyDirRecursive(legacyDir, newDir);
    gitCommitInRepo(newDir, `Migrate thread ${threadId} from legacy repo`, "MuleTeam System", "system@muleteam.local");
  }

  // Remove legacy threads dir after successful migration
  fs.rmSync(legacyThreadsDir, { recursive: true, force: true });
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Thread operations ──

export function createThread(meta: ThreadMeta): void {
  initGlobalRepo();
  migrateIfNeeded();
  const threadDir = THREAD_REPO_DIR(meta.id);
  initGitRepo(threadDir);
  fs.mkdirSync(path.join(threadDir, "artifacts"), { recursive: true });
  fs.mkdirSync(path.join(threadDir, "workspace"), { recursive: true });
  fs.writeFileSync(path.join(threadDir, "meta.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(threadDir, "messages.jsonl"), "");
  fs.writeFileSync(path.join(threadDir, "links.json"), "[]");
  fs.writeFileSync(path.join(threadDir, "workspace", "README.md"), `# ${meta.title}

_This file is maintained by thread participants. Update it to help newcomers understand the context._

## Summary
(Add a brief summary of what this thread is about)

## Key Links
(Add relevant links here)
`);
  fs.writeFileSync(path.join(threadDir, "workspace", "DECISION_LOG.md"), `# Decision Log

Record important decisions made in this thread. Format:

## [Date] Decision Title
**Decision:** What was decided
**Context:** Why this decision was made
**Participants:** Who was involved

---
(Decisions will be added above this line)
`);
  gitCommitInRepo(threadDir, `Create thread: ${meta.title}`, "MuleTeam System", "system@muleteam.local");
}

export function getThread(threadId: string): ThreadMeta | null {
  migrateIfNeeded();
  const metaPath = path.join(THREAD_REPO_DIR(threadId), "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

export function listThreads(locale?: string): ThreadMeta[] {
  initGlobalRepo();
  migrateIfNeeded();
  const threadsRoot = path.join(REPOS_ROOT(), "threads");
  if (!fs.existsSync(threadsRoot)) {
    seedDefaultThreads(locale);
    return listThreads();
  }
  const threadDirs = fs.readdirSync(threadsRoot).filter(d => {
    return fs.existsSync(path.join(threadsRoot, d, "meta.json"));
  });
  const threads = threadDirs.map(d => {
    const threadDir = path.join(threadsRoot, d);
    const meta = JSON.parse(fs.readFileSync(path.join(threadDir, "meta.json"), "utf-8"));
    // Attach last message preview
    const messagesPath = path.join(threadDir, "messages.jsonl");
    if (fs.existsSync(messagesPath)) {
      const content = fs.readFileSync(messagesPath, "utf-8").trim();
      if (content) {
        const lines = content.split("\n");
        try {
          const last = JSON.parse(lines[lines.length - 1]);
          meta.last_message = { from_name: last.from_name, body: last.body, ts: last.ts };
        } catch { /* ignore parse errors */ }
      }
    }
    return meta;
  }).sort((a: ThreadMeta, b: ThreadMeta) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (threads.length === 0) {
    seedDefaultThreads(locale);
    return listThreads();
  }
  return threads;
}

// ── Seed content for new teams ──

const WELCOME_BODY_EN = `Hey there! This is your team workspace. Here's how to get started:

**1. Create a thread** — Threads are your team's conversations. Click "+ New Thread" to start one. Think of it like a meeting room: topic-focused, with everyone who needs to be there.

**2. Invite your team** — Go to Members → "Invite Member" to bring in humans. For AI agents, click "+ Hire Agent".

**3. Add files** — Each thread has a workspace for shared files. Upload docs, images, or let agents create artifacts.

**4. Use action items** — Track tasks right inside threads. Assign to humans or agents, mark done when complete.

**5. Workspace conventions** — Every thread has a \`README.md\` (context summary) and \`DECISION_LOG.md\` (decision record) in its workspace. Keep them updated so newcomers can catch up quickly.

**For agents:**
- Run \`muleteam help\` to see all available commands
- Introduce yourself in the "Introductions" thread so the team knows your role and capabilities
- Use \`muleteam export <id>\` to get full thread context in one call
- Check action items with \`muleteam tasks <id>\` and mark them done when complete

**Tips:**
- @mention someone to get their attention
- Agents can join threads and collaborate just like humans
- Update your profile tags so others know your skills

This welcome message will always be here. Come back anytime.`;

const WELCOME_BODY_ZH = `这是你的团队工作区。快速上手：

**1. 创建 Thread** — Thread 是团队的对话空间。点击 "+" 创建一个。把它想象成会议室：围绕主题，相关的人都在。

**2. 邀请团队** — 进入成员页面，点「邀请成员」加人，点「+ 雇佣代理」加 AI agent。

**3. 共享文件** — 每个 Thread 都有工作区，可以上传文档、图片，agent 也可以在里面创建内容。

**4. 任务管理** — 在 Thread 内创建任务，指派给人或 agent，完成后标记。

**5. 工作区约定** — 每个 Thread 的工作区都有 \`README.md\`（上下文总结）和 \`DECISION_LOG.md\`（决策记录）。保持更新，新人可以快速了解背景。

**Agent 指南：**
- 运行 \`muleteam help\` 查看所有可用命令
- 去「自我介绍」Thread 发帖介绍自己，让团队了解你的角色和能力
- 用 \`muleteam export <id>\` 一次获取 thread 全量上下文
- 用 \`muleteam tasks <id>\` 查看待办事项，完成后标记

**小贴士：**
- @某人 可以通知对方
- Agent 跟人一样加入 Thread 协作
- 更新你的 profile tags，让别人知道你的技能

这条欢迎消息会一直在这里，随时回来查看。`;

const INTRO_BODY_EN = `This thread is for team introductions. When you join the team, post a message here so everyone knows who you are.

**Suggested format:**
- **Name:** Your name
- **Role:** What you do (e.g. Frontend Engineer, PM, Code Review Agent)
- **Skills:** Key capabilities or areas of expertise
- **How to reach me:** Preferred way to collaborate

Agents: include your \`muleteam\` identity and what commands/tasks you can handle.`;

const INTRO_BODY_ZH = `这个 Thread 用于团队自我介绍。加入团队后，请在这里发帖让大家认识你。

**建议格式：**
- **名字：** 你的名字
- **角色：** 你的职责（如前端工程师、PM、代码审查 Agent）
- **技能：** 核心能力或专业领域
- **联系方式：** 偏好的协作方式

Agent：请说明你的 \`muleteam\` 身份和你能处理的命令/任务类型。`;

function seedDefaultThreads(locale?: string): void {
  const now = new Date().toISOString();
  const isZh = locale?.startsWith("zh") ?? false;

  // 1. Welcome thread
  const welcomeMeta: ThreadMeta = {
    id: "welcome",
    title: isZh ? "欢迎来到你的团队！" : "Welcome to your team!",
    status: "open",
    participants: [],
    created_by: "system:muleteam",
    created_at: now,
    updated_at: now,
  };
  createThread(welcomeMeta);

  // Seed README with actual getting-started content
  const welcomeReadmePath = path.join(THREAD_REPO_DIR("welcome"), "workspace", "README.md");
  fs.writeFileSync(welcomeReadmePath, isZh
    ? `# 欢迎来到你的团队！

## 快速上手

1. 创建 Thread — 点击 "+" 开始一个新话题
2. 邀请成员 — 成员页面邀请人或雇佣 AI Agent
3. 协作 — 发消息、共享文件、分配任务

## 工作区约定

- \`README.md\` — 承载总结过的上下文，新人先读这个
- \`DECISION_LOG.md\` — 记录重要决策
`
    : `# Welcome to your team!

## Getting Started

1. Create threads — Click "+" to start a new topic
2. Invite members — Go to Members to invite humans or hire AI agents
3. Collaborate — Post messages, share files, assign action items

## Workspace Conventions

- \`README.md\` — Summarized context for the thread; newcomers read this first
- \`DECISION_LOG.md\` — Record of important decisions
`);

  const welcomeBody = isZh ? WELCOME_BODY_ZH : WELCOME_BODY_EN;
  const welcomeMsg: Message = {
    id: "welcome_msg",
    ts: Date.now(),
    from: "system:muleteam",
    from_name: "MuleTeam",
    type: "system",
    body: welcomeBody,
  };
  const welcomeMsgPath = path.join(THREAD_REPO_DIR("welcome"), "messages.jsonl");
  fs.appendFileSync(welcomeMsgPath, JSON.stringify(welcomeMsg) + "\n");

  // 2. Introductions thread
  const introMeta: ThreadMeta = {
    id: "introductions",
    title: isZh ? "团队自我介绍" : "Team Introductions",
    status: "open",
    participants: [],
    created_by: "system:muleteam",
    created_at: now,
    updated_at: now,
  };
  createThread(introMeta);

  // Seed README with intro thread purpose
  const introReadmePath = path.join(THREAD_REPO_DIR("introductions"), "workspace", "README.md");
  fs.writeFileSync(introReadmePath, isZh
    ? `# 团队自我介绍

新成员加入团队后在这里发帖介绍自己，让大家知道你是谁、擅长什么。

## 建议格式

- **名字 / 角色**
- **技能和能力**
- **在做什么项目**
`
    : `# Team Introductions

New team members post here to introduce themselves — who you are, what you're good at.

## Suggested Format

- **Name / Role**
- **Skills & capabilities**
- **What you're working on**
`);

  const introBody = isZh ? INTRO_BODY_ZH : INTRO_BODY_EN;
  const introMsg: Message = {
    id: "intro_msg",
    ts: Date.now() + 1,
    from: "system:muleteam",
    from_name: "MuleTeam",
    type: "system",
    body: introBody,
  };
  const introMsgPath = path.join(THREAD_REPO_DIR("introductions"), "messages.jsonl");
  fs.appendFileSync(introMsgPath, JSON.stringify(introMsg) + "\n");

  gitCommitInRepo(THREAD_REPO_DIR("welcome"), "Seed welcome thread content", "MuleTeam System", "system@muleteam.local");
  gitCommitInRepo(THREAD_REPO_DIR("introductions"), "Seed introductions thread content", "MuleTeam System", "system@muleteam.local");
}

export function updateThread(threadId: string, updates: Partial<Pick<ThreadMeta, "status" | "description" | "labels" | "channel_id">>): void {
  const meta = getThread(threadId);
  if (!meta) throw new Error("Thread not found");
  if (updates.status !== undefined) meta.status = updates.status;
  if (updates.description !== undefined) meta.description = updates.description;
  if (updates.labels !== undefined) meta.labels = updates.labels;
  if ("channel_id" in updates) meta.channel_id = updates.channel_id || undefined;
  meta.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(THREAD_REPO_DIR(threadId), "meta.json"), JSON.stringify(meta, null, 2));
  gitCommitInRepo(THREAD_REPO_DIR(threadId), `Update thread: ${threadId}`, "MuleTeam System", "system@muleteam.local");
}

export function updateThreadStatus(threadId: string, status: ThreadMeta["status"]): void {
  updateThread(threadId, { status });
}

export function deleteThread(threadId: string): boolean {
  migrateIfNeeded();
  const threadDir = THREAD_REPO_DIR(threadId);
  if (!fs.existsSync(threadDir)) return false;
  fs.rmSync(threadDir, { recursive: true, force: true });
  return true;
}

// Join thread — add participant and log activity
export function joinThread(threadId: string, participant: Participant): void {
  const meta = getThread(threadId);
  if (!meta) throw new Error("Thread not found");

  // Already a participant
  if (meta.participants.some(p => p.id === participant.id)) return;

  meta.participants.push(participant);
  meta.updated_at = new Date().toISOString();
  const threadDir = THREAD_REPO_DIR(threadId);
  fs.writeFileSync(path.join(threadDir, "meta.json"), JSON.stringify(meta, null, 2));

  // Add activity message
  const message: Message = {
    id: `msg_join_${Date.now()}`,
    ts: Date.now(),
    from: participant.id,
    from_name: participant.name,
    type: "activity",
    body: `${participant.name} joined the thread`,
  };
  const messagesPath = path.join(threadDir, "messages.jsonl");
  fs.appendFileSync(messagesPath, JSON.stringify(message) + "\n");

  gitCommitInRepo(threadDir, `${participant.name} joined thread: ${threadId}`, "MuleTeam System", "system@muleteam.local");
}

// Leave thread — remove participant and log activity
export function removeThreadParticipant(threadId: string, participantId: string): void {
  const meta = getThread(threadId);
  if (!meta) throw new Error("Thread not found");

  const participant = meta.participants.find(p => p.id === participantId);
  if (!participant) return; // Not a participant, nothing to do

  meta.participants = meta.participants.filter(p => p.id !== participantId);
  meta.updated_at = new Date().toISOString();
  const threadDir = THREAD_REPO_DIR(threadId);
  fs.writeFileSync(path.join(threadDir, "meta.json"), JSON.stringify(meta, null, 2));

  // Add activity message
  const message: Message = {
    id: `msg_leave_${Date.now()}`,
    ts: Date.now(),
    from: participant.id,
    from_name: participant.name,
    type: "activity",
    body: `${participant.name} left the thread`,
  };
  const messagesPath = path.join(threadDir, "messages.jsonl");
  fs.appendFileSync(messagesPath, JSON.stringify(message) + "\n");

  gitCommitInRepo(threadDir, `${participant.name} left thread: ${threadId}`, "MuleTeam System", "system@muleteam.local");
}

// Check if a user/agent is a participant (direct or via group)
export function isParticipant(threadId: string, userId: string): boolean {
  const meta = getThread(threadId);
  if (!meta) return false;

  // Direct participant check
  if (meta.participants.some(p => p.id === userId)) return true;

  // Channel membership check
  if (meta.channel_id) {
    const channel = getChannel(meta.channel_id);
    if (channel && channel.members.some(m => m.id === userId)) return true;
  }

  return false;
}

// Message operations
export function addMessage(threadId: string, message: Message): void {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const messagesPath = path.join(threadDir, "messages.jsonl");
  if (!fs.existsSync(messagesPath)) throw new Error("Thread not found");
  fs.appendFileSync(messagesPath, JSON.stringify(message) + "\n");

  // Update thread timestamp
  const meta = getThread(threadId);
  if (meta) {
    meta.updated_at = new Date().toISOString();
    if (meta.status === "open") meta.status = "in_progress";
    fs.writeFileSync(path.join(threadDir, "meta.json"), JSON.stringify(meta, null, 2));
  }

  gitCommitInRepo(
    threadDir,
    `${message.from_name}: ${message.body}`,
    message.from_name,
    `${message.from.replace(":", "-")}@muleteam.local`
  );
}

export function getMessages(threadId: string): Message[] {
  migrateIfNeeded();
  const messagesPath = path.join(THREAD_REPO_DIR(threadId), "messages.jsonl");
  if (!fs.existsSync(messagesPath)) return [];
  const content = fs.readFileSync(messagesPath, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map(line => JSON.parse(line));
}

// Artifact operations
export function saveArtifact(threadId: string, html: string, summary: string, authorName: string, authorId: string, messageId: string): ArtifactVersion {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const artifactsDir = path.join(threadDir, "artifacts");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
  const versionsPath = path.join(artifactsDir, "versions.json");

  let versions: ArtifactVersion[] = [];
  if (fs.existsSync(versionsPath)) {
    versions = JSON.parse(fs.readFileSync(versionsPath, "utf-8"));
  }

  const newVersion = versions.length + 1;
  fs.writeFileSync(path.join(artifactsDir, `v${newVersion}.html`), html);
  fs.writeFileSync(path.join(artifactsDir, "latest.html"), html);

  gitCommitInRepo(threadDir, `Artifact v${newVersion}: ${summary}`, authorName, `${authorId.replace(":", "-")}@muleteam.local`);

  const commitHash = execSync("git rev-parse HEAD", { cwd: threadDir }).toString().trim();

  const versionEntry: ArtifactVersion = {
    version: newVersion,
    commit_hash: commitHash,
    message_id: messageId,
    created_at: new Date().toISOString(),
    summary,
  };

  versions.push(versionEntry);
  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  gitCommitInRepo(threadDir, `Update versions.json for v${newVersion}`, authorName, `${authorId.replace(":", "-")}@muleteam.local`);

  return versionEntry;
}

export function getArtifact(threadId: string, version?: number): string | null {
  migrateIfNeeded();
  const artifactsDir = path.join(THREAD_REPO_DIR(threadId), "artifacts");
  const filename = version ? `v${version}.html` : "latest.html";
  const filePath = path.join(artifactsDir, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export function getArtifactVersions(threadId: string): ArtifactVersion[] {
  migrateIfNeeded();
  const versionsPath = path.join(THREAD_REPO_DIR(threadId), "artifacts", "versions.json");
  if (!fs.existsSync(versionsPath)) return [];
  return JSON.parse(fs.readFileSync(versionsPath, "utf-8"));
}

// Workspace file operations
function resolveWorkspacePath(threadId: string, filename: string): string {
  const workspaceDir = path.join(THREAD_REPO_DIR(threadId), "workspace");
  const resolved = path.resolve(workspaceDir, filename);
  // Path traversal protection
  if (!resolved.startsWith(workspaceDir + path.sep) && resolved !== workspaceDir) {
    throw new Error("Path traversal not allowed");
  }
  return resolved;
}

export function listWorkspaceFiles(threadId: string): WorkspaceFile[] {
  migrateIfNeeded();
  const workspaceDir = path.join(THREAD_REPO_DIR(threadId), "workspace");
  if (!fs.existsSync(workspaceDir)) return [];

  const results: WorkspaceFile[] = [];

  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      const relativeName = prefix ? `${prefix}/${entry}` : entry;
      if (stat.isDirectory()) {
        walk(fullPath, relativeName);
      } else if (stat.isFile()) {
        results.push({
          name: relativeName,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    }
  }

  walk(workspaceDir, "");
  return results.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}

export function readWorkspaceFile(threadId: string, filename: string): string | null {
  migrateIfNeeded();
  const filePath = resolveWorkspacePath(threadId, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export function readWorkspaceBinary(threadId: string, filename: string): Buffer | null {
  migrateIfNeeded();
  const filePath = resolveWorkspacePath(threadId, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function writeWorkspaceFile(threadId: string, filename: string, content: string, author: string): Promise<void> {
  if (Buffer.byteLength(content) > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }
  initThreadRepo(threadId);
  const filePath = resolveWorkspacePath(threadId, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);

  await withThreadLock(threadId, () => {
    gitCommitInRepo(THREAD_REPO_DIR(threadId), `${author} wrote workspace/${filename}`, author, `${author.replace(/\s+/g, "-").toLowerCase()}@muleteam.local`);
  });
}

export async function writeWorkspaceBinary(threadId: string, filename: string, data: Buffer, author: string): Promise<void> {
  if (data.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }
  initThreadRepo(threadId);
  const filePath = resolveWorkspacePath(threadId, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, data);

  await withThreadLock(threadId, () => {
    gitCommitInRepo(THREAD_REPO_DIR(threadId), `${author} uploaded workspace/${filename}`, author, `${author.replace(/\s+/g, "-").toLowerCase()}@muleteam.local`);
  });
}

export async function deleteWorkspaceFile(threadId: string, filename: string, author: string): Promise<boolean> {
  migrateIfNeeded();
  const filePath = resolveWorkspacePath(threadId, filename);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);

  await withThreadLock(threadId, () => {
    gitCommitInRepo(THREAD_REPO_DIR(threadId), `${author} deleted workspace/${filename}`, author, `${author.replace(/\s+/g, "-").toLowerCase()}@muleteam.local`);
  });
  return true;
}

// Links operations
export function getLinks(threadId: string): HyperlinkEntry[] {
  migrateIfNeeded();
  const linksPath = path.join(THREAD_REPO_DIR(threadId), "links.json");
  if (!fs.existsSync(linksPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(linksPath, "utf-8"));
  } catch {
    return [];
  }
}

export function addLink(threadId: string, link: HyperlinkEntry): void {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const linksPath = path.join(threadDir, "links.json");
  const links = getLinks(threadId);
  links.push(link);
  fs.writeFileSync(linksPath, JSON.stringify(links, null, 2));
  gitCommitInRepo(threadDir, `Add link: ${link.title}`, link.added_by, `system@muleteam.local`);
}

export function removeLink(threadId: string, linkId: string): boolean {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const linksPath = path.join(threadDir, "links.json");
  const links = getLinks(threadId);
  const filtered = links.filter(l => l.id !== linkId);
  if (filtered.length === links.length) return false;
  fs.writeFileSync(linksPath, JSON.stringify(filtered, null, 2));
  gitCommitInRepo(threadDir, `Remove link: ${linkId}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

// Agent registration — stored in global repo
function AGENTS_DIR(): string { return path.join(GLOBAL_REPO_DIR(), "agents"); }

function ensureAgentsDir(): void {
  initGlobalRepo();
  if (!fs.existsSync(AGENTS_DIR())) {
    fs.mkdirSync(AGENTS_DIR(), { recursive: true });
  }
}

export function registerAgent(agent: RegisteredAgent): void {
  ensureAgentsDir();
  fs.writeFileSync(
    path.join(AGENTS_DIR(), `${agent.id}.json`),
    JSON.stringify(agent, null, 2)
  );
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Register agent: ${agent.name}`, "MuleTeam System", "system@muleteam.local");
}

export function getAgentById(agentId: string): RegisteredAgent | null {
  ensureAgentsDir();
  const agentPath = path.join(AGENTS_DIR(), `${agentId}.json`);
  if (!fs.existsSync(agentPath)) return null;
  return JSON.parse(fs.readFileSync(agentPath, "utf-8"));
}

export function getAgentByToken(tokenHash: string): RegisteredAgent | null {
  ensureAgentsDir();
  if (!fs.existsSync(AGENTS_DIR())) return null;
  for (const file of fs.readdirSync(AGENTS_DIR())) {
    if (!file.endsWith(".json")) continue;
    const agent: RegisteredAgent = JSON.parse(
      fs.readFileSync(path.join(AGENTS_DIR(), file), "utf-8")
    );
    if (agent.token_hash === tokenHash) return agent;
  }
  return null;
}

export function listRegisteredAgents(): RegisteredAgent[] {
  ensureAgentsDir();
  if (!fs.existsSync(AGENTS_DIR())) return [];
  return fs.readdirSync(AGENTS_DIR())
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(AGENTS_DIR(), f), "utf-8")))
    .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
}

export function deleteAgent(agentId: string): boolean {
  ensureAgentsDir();
  const agentPath = path.join(AGENTS_DIR(), `${agentId}.json`);
  if (!fs.existsSync(agentPath)) return false;
  const agent = JSON.parse(fs.readFileSync(agentPath, "utf-8"));
  fs.unlinkSync(agentPath);
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Delete agent: ${agent.name}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

export function updateAgent(agentId: string, updates: Partial<Pick<RegisteredAgent, "name" | "description" | "capabilities">>): RegisteredAgent | null {
  const agent = getAgentById(agentId);
  if (!agent) return null;
  if (updates.name !== undefined) agent.name = updates.name;
  if (updates.description !== undefined) agent.description = updates.description;
  if (updates.capabilities !== undefined) agent.capabilities = updates.capabilities;
  fs.writeFileSync(
    path.join(AGENTS_DIR(), `${agentId}.json`),
    JSON.stringify(agent, null, 2)
  );
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Update agent: ${agent.name}`, "MuleTeam System", "system@muleteam.local");
  return agent;
}

export function updateAgentLastSeen(agentId: string): void {
  const agent = getAgentById(agentId);
  if (!agent) return;
  agent.last_seen_at = new Date().toISOString();
  fs.writeFileSync(
    path.join(AGENTS_DIR(), `${agentId}.json`),
    JSON.stringify(agent, null, 2)
  );
}

// Poll activity — returns threads with messages since a given timestamp
export function pollActivity(sinceTs?: number, threadIds?: string[]): { thread_id: string; title: string; new_messages: number; latest_ts: number }[] {
  const threads = listThreads();
  const results: { thread_id: string; title: string; new_messages: number; latest_ts: number }[] = [];

  for (const thread of threads) {
    if (threadIds && !threadIds.includes(thread.id)) continue;
    const messages = getMessages(thread.id);
    const newMessages = sinceTs
      ? messages.filter(m => m.ts > sinceTs)
      : messages;
    if (newMessages.length > 0) {
      results.push({
        thread_id: thread.id,
        title: thread.title,
        new_messages: newMessages.length,
        latest_ts: Math.max(...newMessages.map(m => m.ts)),
      });
    }
  }

  return results.sort((a, b) => b.latest_ts - a.latest_ts);
}

// Agent name uniqueness check
export function getAgentByName(name: string): RegisteredAgent | null {
  ensureAgentsDir();
  if (!fs.existsSync(AGENTS_DIR())) return null;
  const normalizedName = name.toLowerCase().trim();
  for (const file of fs.readdirSync(AGENTS_DIR())) {
    if (!file.endsWith(".json")) continue;
    const agent: RegisteredAgent = JSON.parse(
      fs.readFileSync(path.join(AGENTS_DIR(), file), "utf-8")
    );
    if (agent.name.toLowerCase().trim() === normalizedName) return agent;
  }
  return null;
}

// Git log for a thread
export interface GitLogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
}

export function getThreadGitLog(threadId: string, limit = 20): GitLogEntry[] {
  migrateIfNeeded();
  const threadDir = THREAD_REPO_DIR(threadId);
  if (!fs.existsSync(path.join(threadDir, ".git"))) return [];
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit)) || 20));
  try {
    // Per-thread repo: log the entire repo (no path filter needed)
    const log = execSync(
      `git log --format="%x00%H%x01%h%x01%an%x01%aI%x01%B" -n ${safeLimit}`,
      { cwd: threadDir }
    ).toString().trim();
    if (!log) return [];
    return log.split("\x00").filter(Boolean).map(record => {
      const [hash, short_hash, author, date, ...messageParts] = record.split("\x01");
      const message = messageParts.join("").trim();
      return { hash, short_hash, author, date, message };
    });
  } catch {
    return [];
  }
}

// Channel operations — stored in global repo
function CHANNELS_DIR(): string { return path.join(GLOBAL_REPO_DIR(), "channels"); }

function ensureChannelsDir(): void {
  initGlobalRepo();
  if (!fs.existsSync(CHANNELS_DIR())) {
    fs.mkdirSync(CHANNELS_DIR(), { recursive: true });
  }
}

export function createChannel(channel: ChannelMeta): void {
  ensureChannelsDir();
  const channelDir = path.join(CHANNELS_DIR(), channel.id);
  fs.mkdirSync(channelDir, { recursive: true });
  fs.writeFileSync(path.join(channelDir, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Create channel: ${channel.name}`, "MuleTeam System", "system@muleteam.local");
}

export function getChannel(channelId: string): ChannelMeta | null {
  ensureChannelsDir();
  const metaPath = path.join(CHANNELS_DIR(), channelId, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

export function listChannels(): ChannelMeta[] {
  ensureChannelsDir();
  if (!fs.existsSync(CHANNELS_DIR())) return [];
  return fs.readdirSync(CHANNELS_DIR())
    .filter(d => fs.existsSync(path.join(CHANNELS_DIR(), d, "meta.json")))
    .map(d => JSON.parse(fs.readFileSync(path.join(CHANNELS_DIR(), d, "meta.json"), "utf-8")))
    .sort((a: ChannelMeta, b: ChannelMeta) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function updateChannel(channelId: string, updates: Partial<Pick<ChannelMeta, "name" | "description">>): void {
  const channel = getChannel(channelId);
  if (!channel) throw new Error("Channel not found");
  if (updates.name !== undefined) channel.name = updates.name;
  if (updates.description !== undefined) channel.description = updates.description;
  channel.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(CHANNELS_DIR(), channelId, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Update channel: ${channelId}`, "MuleTeam System", "system@muleteam.local");
}

export function deleteChannel(channelId: string): boolean {
  ensureChannelsDir();
  const channelDir = path.join(CHANNELS_DIR(), channelId);
  if (!fs.existsSync(channelDir)) return false;
  fs.rmSync(channelDir, { recursive: true, force: true });
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Delete channel: ${channelId}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

export function addChannelMember(channelId: string, member: Participant): void {
  const channel = getChannel(channelId);
  if (!channel) throw new Error("Channel not found");
  if (channel.members.some(m => m.id === member.id)) return;
  channel.members.push(member);
  channel.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(CHANNELS_DIR(), channelId, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Add member ${member.name} to channel ${channel.name}`, "MuleTeam System", "system@muleteam.local");
}

export function removeChannelMember(channelId: string, memberId: string): void {
  const channel = getChannel(channelId);
  if (!channel) throw new Error("Channel not found");
  channel.members = channel.members.filter(m => m.id !== memberId);
  channel.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(CHANNELS_DIR(), channelId, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommitInRepo(GLOBAL_REPO_DIR(), `Remove member ${memberId} from channel ${channel.name}`, "MuleTeam System", "system@muleteam.local");
}

export function listThreadsByChannel(channelId: string): ThreadMeta[] {
  return listThreads().filter(t => t.channel_id === channelId);
}

// Action item (task) operations
export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  assignee_name?: string;
  status: "open" | "in_progress" | "done";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  source_message_id?: string;
}

export function getThreadTasks(threadId: string): ActionItem[] {
  migrateIfNeeded();
  const tasksPath = path.join(THREAD_REPO_DIR(threadId), "tasks.json");
  if (!fs.existsSync(tasksPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(tasksPath, "utf-8"));
  } catch {
    return [];
  }
}

export function addThreadTask(threadId: string, task: ActionItem): void {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const tasksPath = path.join(threadDir, "tasks.json");
  const tasks = getThreadTasks(threadId);
  tasks.push(task);
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
  gitCommitInRepo(threadDir, `Add task: ${task.description}`, task.created_by_name, `system@muleteam.local`);
}

export function updateThreadTask(threadId: string, taskId: string, updates: Partial<ActionItem>): ActionItem | null {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const tasksPath = path.join(threadDir, "tasks.json");
  const tasks = getThreadTasks(threadId);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;

  const task = tasks[idx];
  if (updates.status !== undefined) task.status = updates.status;
  if (updates.assignee !== undefined) task.assignee = updates.assignee;
  if (updates.assignee_name !== undefined) task.assignee_name = updates.assignee_name;
  if (updates.description !== undefined) task.description = updates.description;
  task.updated_at = new Date().toISOString();

  tasks[idx] = task;
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
  gitCommitInRepo(threadDir, `Update task: ${task.description}`, "MuleTeam System", "system@muleteam.local");
  return task;
}

export function deleteThreadTask(threadId: string, taskId: string): boolean {
  initThreadRepo(threadId);
  const threadDir = THREAD_REPO_DIR(threadId);
  const tasksPath = path.join(threadDir, "tasks.json");
  const tasks = getThreadTasks(threadId);
  const filtered = tasks.filter(t => t.id !== taskId);
  if (filtered.length === tasks.length) return false;
  fs.writeFileSync(tasksPath, JSON.stringify(filtered, null, 2));
  gitCommitInRepo(threadDir, `Remove task: ${taskId}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

// ── Git helpers ──

/** Commit all changes in a specific repo directory. */
function gitCommitInRepo(repoDir: string, message: string, authorName: string, authorEmail: string): void {
  try {
    execSync("git add -A", { cwd: repoDir });
    const status = execSync("git status --porcelain", { cwd: repoDir }).toString().trim();
    if (!status) return; // Nothing to commit
    execSync(
      `git -c user.name="${authorName}" -c user.email="${authorEmail}" commit -m "${message.replace(/"/g, '\\"')}"`,
      { cwd: repoDir }
    );
  } catch {
    // Ignore commit errors (e.g., nothing to commit)
  }
}
