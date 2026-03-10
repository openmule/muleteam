import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const REPO_BASE = process.env.GIT_REPO_PATH || path.join(process.cwd(), ".data", "repo");

// In-memory mutex for git operations
let gitLock: Promise<void> = Promise.resolve();

// Types
export interface ThreadMeta {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "done" | "archived";
  labels?: string[];
  participants: Participant[];
  channel_id?: string;
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
  created_at: string;
  updated_at: string;
}

// Initialize the repo directory
export function initRepo(): void {
  if (!fs.existsSync(REPO_BASE)) {
    fs.mkdirSync(REPO_BASE, { recursive: true });
    execSync("git init", { cwd: REPO_BASE });
    execSync('git config user.email "system@muleteam.local"', { cwd: REPO_BASE });
    execSync('git config user.name "MuleTeam System"', { cwd: REPO_BASE });
    fs.writeFileSync(path.join(REPO_BASE, ".gitkeep"), "");
    execSync("git add . && git commit -m 'init'", { cwd: REPO_BASE });
  }
}

// Thread operations
export function createThread(meta: ThreadMeta): void {
  initRepo();
  const threadDir = path.join(REPO_BASE, "threads", meta.id);
  fs.mkdirSync(threadDir, { recursive: true });
  fs.mkdirSync(path.join(threadDir, "artifacts"), { recursive: true });
  fs.mkdirSync(path.join(threadDir, "workspace"), { recursive: true });
  fs.writeFileSync(path.join(threadDir, "meta.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(threadDir, "messages.jsonl"), "");
  fs.writeFileSync(path.join(threadDir, "links.json"), "[]");
  fs.writeFileSync(path.join(threadDir, "workspace", "README.md"), `# ${meta.title}\n\nWorkspace files for this thread.\n`);
  gitCommit(`Create thread: ${meta.title}`, "MuleTeam System", "system@muleteam.local");
}

export function getThread(threadId: string): ThreadMeta | null {
  initRepo();
  const metaPath = path.join(REPO_BASE, "threads", threadId, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

export function listThreads(): ThreadMeta[] {
  initRepo();
  const threadsDir = path.join(REPO_BASE, "threads");
  if (!fs.existsSync(threadsDir)) return [];
  return fs.readdirSync(threadsDir)
    .filter(d => fs.existsSync(path.join(threadsDir, d, "meta.json")))
    .map(d => JSON.parse(fs.readFileSync(path.join(threadsDir, d, "meta.json"), "utf-8")))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function updateThread(threadId: string, updates: Partial<Pick<ThreadMeta, "status" | "description" | "labels">>): void {
  const meta = getThread(threadId);
  if (!meta) throw new Error("Thread not found");
  if (updates.status !== undefined) meta.status = updates.status;
  if (updates.description !== undefined) meta.description = updates.description;
  if (updates.labels !== undefined) meta.labels = updates.labels;
  meta.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(REPO_BASE, "threads", threadId, "meta.json"), JSON.stringify(meta, null, 2));
  gitCommit(`Update thread: ${threadId}`, "MuleTeam System", "system@muleteam.local");
}

export function updateThreadStatus(threadId: string, status: ThreadMeta["status"]): void {
  updateThread(threadId, { status });
}

export function deleteThread(threadId: string): boolean {
  initRepo();
  const threadDir = path.join(REPO_BASE, "threads", threadId);
  if (!fs.existsSync(threadDir)) return false;
  fs.rmSync(threadDir, { recursive: true, force: true });
  gitCommit(`Delete thread: ${threadId}`, "MuleTeam System", "system@muleteam.local");
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
  fs.writeFileSync(path.join(REPO_BASE, "threads", threadId, "meta.json"), JSON.stringify(meta, null, 2));

  // Add activity message
  const message: Message = {
    id: `msg_join_${Date.now()}`,
    ts: Date.now(),
    from: participant.id,
    from_name: participant.name,
    type: "activity",
    body: `${participant.name} joined the thread`,
  };
  const messagesPath = path.join(REPO_BASE, "threads", threadId, "messages.jsonl");
  fs.appendFileSync(messagesPath, JSON.stringify(message) + "\n");

  gitCommit(`${participant.name} joined thread: ${threadId}`, "MuleTeam System", "system@muleteam.local");
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
  initRepo();
  const messagesPath = path.join(REPO_BASE, "threads", threadId, "messages.jsonl");
  if (!fs.existsSync(messagesPath)) throw new Error("Thread not found");
  fs.appendFileSync(messagesPath, JSON.stringify(message) + "\n");

  // Update thread timestamp
  const meta = getThread(threadId);
  if (meta) {
    meta.updated_at = new Date().toISOString();
    if (meta.status === "open") meta.status = "in_progress";
    fs.writeFileSync(path.join(REPO_BASE, "threads", threadId, "meta.json"), JSON.stringify(meta, null, 2));
  }

  gitCommit(
    `${message.from_name}: ${message.body}`,
    message.from_name,
    `${message.from.replace(":", "-")}@muleteam.local`
  );
}

export function getMessages(threadId: string): Message[] {
  initRepo();
  const messagesPath = path.join(REPO_BASE, "threads", threadId, "messages.jsonl");
  if (!fs.existsSync(messagesPath)) return [];
  const content = fs.readFileSync(messagesPath, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map(line => JSON.parse(line));
}

// Artifact operations
export function saveArtifact(threadId: string, html: string, summary: string, authorName: string, authorId: string, messageId: string): ArtifactVersion {
  initRepo();
  const artifactsDir = path.join(REPO_BASE, "threads", threadId, "artifacts");
  const versionsPath = path.join(artifactsDir, "versions.json");

  let versions: ArtifactVersion[] = [];
  if (fs.existsSync(versionsPath)) {
    versions = JSON.parse(fs.readFileSync(versionsPath, "utf-8"));
  }

  const newVersion = versions.length + 1;
  fs.writeFileSync(path.join(artifactsDir, `v${newVersion}.html`), html);
  fs.writeFileSync(path.join(artifactsDir, "latest.html"), html);

  gitCommit(`Artifact v${newVersion}: ${summary}`, authorName, `${authorId.replace(":", "-")}@muleteam.local`);

  const commitHash = execSync("git rev-parse HEAD", { cwd: REPO_BASE }).toString().trim();

  const versionEntry: ArtifactVersion = {
    version: newVersion,
    commit_hash: commitHash,
    message_id: messageId,
    created_at: new Date().toISOString(),
    summary,
  };

  versions.push(versionEntry);
  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  gitCommit(`Update versions.json for v${newVersion}`, authorName, `${authorId.replace(":", "-")}@muleteam.local`);

  return versionEntry;
}

export function getArtifact(threadId: string, version?: number): string | null {
  initRepo();
  const artifactsDir = path.join(REPO_BASE, "threads", threadId, "artifacts");
  const filename = version ? `v${version}.html` : "latest.html";
  const filePath = path.join(artifactsDir, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export function getArtifactVersions(threadId: string): ArtifactVersion[] {
  initRepo();
  const versionsPath = path.join(REPO_BASE, "threads", threadId, "artifacts", "versions.json");
  if (!fs.existsSync(versionsPath)) return [];
  return JSON.parse(fs.readFileSync(versionsPath, "utf-8"));
}

// Workspace file operations
function resolveWorkspacePath(threadId: string, filename: string): string {
  const workspaceDir = path.join(REPO_BASE, "threads", threadId, "workspace");
  const resolved = path.resolve(workspaceDir, filename);
  // Path traversal protection
  if (!resolved.startsWith(workspaceDir + path.sep) && resolved !== workspaceDir) {
    throw new Error("Path traversal not allowed");
  }
  return resolved;
}

export function listWorkspaceFiles(threadId: string): WorkspaceFile[] {
  initRepo();
  const workspaceDir = path.join(REPO_BASE, "threads", threadId, "workspace");
  if (!fs.existsSync(workspaceDir)) return [];

  return fs.readdirSync(workspaceDir)
    .filter(f => {
      const stat = fs.statSync(path.join(workspaceDir, f));
      return stat.isFile();
    })
    .map(f => {
      const stat = fs.statSync(path.join(workspaceDir, f));
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}

export function readWorkspaceFile(threadId: string, filename: string): string | null {
  initRepo();
  const filePath = resolveWorkspacePath(threadId, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function writeWorkspaceFile(threadId: string, filename: string, content: string, author: string): Promise<void> {
  if (Buffer.byteLength(content) > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }
  initRepo();
  const filePath = resolveWorkspacePath(threadId, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);

  await withGitLock(() => {
    gitCommit(`${author} wrote workspace/${filename}`, author, `${author.replace(/\s+/g, "-").toLowerCase()}@muleteam.local`);
  });
}

export async function deleteWorkspaceFile(threadId: string, filename: string, author: string): Promise<boolean> {
  initRepo();
  const filePath = resolveWorkspacePath(threadId, filename);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);

  await withGitLock(() => {
    gitCommit(`${author} deleted workspace/${filename}`, author, `${author.replace(/\s+/g, "-").toLowerCase()}@muleteam.local`);
  });
  return true;
}

// Links operations
export function getLinks(threadId: string): HyperlinkEntry[] {
  initRepo();
  const linksPath = path.join(REPO_BASE, "threads", threadId, "links.json");
  if (!fs.existsSync(linksPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(linksPath, "utf-8"));
  } catch {
    return [];
  }
}

export function addLink(threadId: string, link: HyperlinkEntry): void {
  initRepo();
  const linksPath = path.join(REPO_BASE, "threads", threadId, "links.json");
  const links = getLinks(threadId);
  links.push(link);
  fs.writeFileSync(linksPath, JSON.stringify(links, null, 2));
  gitCommit(`Add link: ${link.title}`, link.added_by, `system@muleteam.local`);
}

export function removeLink(threadId: string, linkId: string): boolean {
  initRepo();
  const linksPath = path.join(REPO_BASE, "threads", threadId, "links.json");
  const links = getLinks(threadId);
  const filtered = links.filter(l => l.id !== linkId);
  if (filtered.length === links.length) return false;
  fs.writeFileSync(linksPath, JSON.stringify(filtered, null, 2));
  gitCommit(`Remove link: ${linkId}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

// Agent registration
const AGENTS_DIR = path.join(REPO_BASE, "agents");

function ensureAgentsDir(): void {
  initRepo();
  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  }
}

export function registerAgent(agent: RegisteredAgent): void {
  ensureAgentsDir();
  fs.writeFileSync(
    path.join(AGENTS_DIR, `${agent.id}.json`),
    JSON.stringify(agent, null, 2)
  );
  gitCommit(`Register agent: ${agent.name}`, "MuleTeam System", "system@muleteam.local");
}

export function getAgentById(agentId: string): RegisteredAgent | null {
  ensureAgentsDir();
  const agentPath = path.join(AGENTS_DIR, `${agentId}.json`);
  if (!fs.existsSync(agentPath)) return null;
  return JSON.parse(fs.readFileSync(agentPath, "utf-8"));
}

export function getAgentByToken(tokenHash: string): RegisteredAgent | null {
  ensureAgentsDir();
  if (!fs.existsSync(AGENTS_DIR)) return null;
  for (const file of fs.readdirSync(AGENTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const agent: RegisteredAgent = JSON.parse(
      fs.readFileSync(path.join(AGENTS_DIR, file), "utf-8")
    );
    if (agent.token_hash === tokenHash) return agent;
  }
  return null;
}

export function listRegisteredAgents(): RegisteredAgent[] {
  ensureAgentsDir();
  if (!fs.existsSync(AGENTS_DIR)) return [];
  return fs.readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, f), "utf-8")))
    .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
}

export function deleteAgent(agentId: string): boolean {
  ensureAgentsDir();
  const agentPath = path.join(AGENTS_DIR, `${agentId}.json`);
  if (!fs.existsSync(agentPath)) return false;
  const agent = JSON.parse(fs.readFileSync(agentPath, "utf-8"));
  fs.unlinkSync(agentPath);
  gitCommit(`Delete agent: ${agent.name}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

export function updateAgentLastSeen(agentId: string): void {
  const agent = getAgentById(agentId);
  if (!agent) return;
  agent.last_seen_at = new Date().toISOString();
  fs.writeFileSync(
    path.join(AGENTS_DIR, `${agentId}.json`),
    JSON.stringify(agent, null, 2)
  );
}

// Poll activity — returns threads with messages since a given timestamp
export function pollActivity(sinceTs?: number, threadIds?: string[]): { thread_id: string; title: string; new_messages: number; latest_ts: number }[] {
  initRepo();
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
  if (!fs.existsSync(AGENTS_DIR)) return null;
  const normalizedName = name.toLowerCase().trim();
  for (const file of fs.readdirSync(AGENTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const agent: RegisteredAgent = JSON.parse(
      fs.readFileSync(path.join(AGENTS_DIR, file), "utf-8")
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
  initRepo();
  const threadDir = path.join("threads", threadId);
  try {
    // Use %x00 as record separator and %x01 as field separator to handle multiline messages
    const log = execSync(
      `git log --format="%x00%H%x01%h%x01%an%x01%aI%x01%B" -n ${limit} -- "${threadDir}"`,
      { cwd: REPO_BASE }
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

// Channel operations
const CHANNELS_DIR = path.join(REPO_BASE, "channels");

function ensureChannelsDir(): void {
  initRepo();
  if (!fs.existsSync(CHANNELS_DIR)) {
    fs.mkdirSync(CHANNELS_DIR, { recursive: true });
  }
}

export function createChannel(channel: ChannelMeta): void {
  ensureChannelsDir();
  const channelDir = path.join(CHANNELS_DIR, channel.id);
  fs.mkdirSync(channelDir, { recursive: true });
  fs.writeFileSync(path.join(channelDir, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommit(`Create channel: ${channel.name}`, "MuleTeam System", "system@muleteam.local");
}

export function getChannel(channelId: string): ChannelMeta | null {
  ensureChannelsDir();
  const metaPath = path.join(CHANNELS_DIR, channelId, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

export function listChannels(): ChannelMeta[] {
  ensureChannelsDir();
  if (!fs.existsSync(CHANNELS_DIR)) return [];
  return fs.readdirSync(CHANNELS_DIR)
    .filter(d => fs.existsSync(path.join(CHANNELS_DIR, d, "meta.json")))
    .map(d => JSON.parse(fs.readFileSync(path.join(CHANNELS_DIR, d, "meta.json"), "utf-8")))
    .sort((a: ChannelMeta, b: ChannelMeta) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function updateChannel(channelId: string, updates: Partial<Pick<ChannelMeta, "name" | "description">>): void {
  const channel = getChannel(channelId);
  if (!channel) throw new Error("Channel not found");
  if (updates.name !== undefined) channel.name = updates.name;
  if (updates.description !== undefined) channel.description = updates.description;
  channel.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(CHANNELS_DIR, channelId, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommit(`Update channel: ${channelId}`, "MuleTeam System", "system@muleteam.local");
}

export function deleteChannel(channelId: string): boolean {
  ensureChannelsDir();
  const channelDir = path.join(CHANNELS_DIR, channelId);
  if (!fs.existsSync(channelDir)) return false;
  fs.rmSync(channelDir, { recursive: true, force: true });
  gitCommit(`Delete channel: ${channelId}`, "MuleTeam System", "system@muleteam.local");
  return true;
}

export function addChannelMember(channelId: string, member: Participant): void {
  const channel = getChannel(channelId);
  if (!channel) throw new Error("Channel not found");
  if (channel.members.some(m => m.id === member.id)) return;
  channel.members.push(member);
  channel.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(CHANNELS_DIR, channelId, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommit(`Add member ${member.name} to channel ${channel.name}`, "MuleTeam System", "system@muleteam.local");
}

export function removeChannelMember(channelId: string, memberId: string): void {
  const channel = getChannel(channelId);
  if (!channel) throw new Error("Channel not found");
  channel.members = channel.members.filter(m => m.id !== memberId);
  channel.updated_at = new Date().toISOString();
  fs.writeFileSync(path.join(CHANNELS_DIR, channelId, "meta.json"), JSON.stringify(channel, null, 2));
  gitCommit(`Remove member ${memberId} from channel ${channel.name}`, "MuleTeam System", "system@muleteam.local");
}

export function listThreadsByChannel(channelId: string): ThreadMeta[] {
  return listThreads().filter(t => t.channel_id === channelId);
}

// Git helpers
function gitCommit(message: string, authorName: string, authorEmail: string): void {
  try {
    execSync("git add -A", { cwd: REPO_BASE });
    const status = execSync("git status --porcelain", { cwd: REPO_BASE }).toString().trim();
    if (!status) return; // Nothing to commit
    execSync(
      `git -c user.name="${authorName}" -c user.email="${authorEmail}" commit -m "${message.replace(/"/g, '\\"')}"`,
      { cwd: REPO_BASE }
    );
  } catch {
    // Ignore commit errors (e.g., nothing to commit)
  }
}

// Serialize git commit operations
async function withGitLock<T>(fn: () => T): Promise<T> {
  const prev = gitLock;
  let resolve: () => void;
  gitLock = new Promise<void>(r => { resolve = r; });
  await prev;
  try {
    return fn();
  } finally {
    resolve!();
  }
}
