import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ensureMigrations } from "@/lib/db-migrate";
import {
  createThread,
  createChannel,
  registerAgent,
  addMessage,
  addThreadTask,
  addLink,
  initRepo,
  type ThreadMeta,
  type Message,
  type ActionItem,
  type ChannelMeta,
  type RegisteredAgent,
  type Participant,
} from "@/lib/git-storage";
import { clearRepo } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";
import { getSeedLocale } from "./seed-locale";
import crypto from "crypto";

// ── Helpers ──

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3600000).toISOString();
}

function tsHoursAgo(n: number) {
  return Date.now() - n * 3600000;
}

// ── Data Definitions ──

const HUMANS = [
  { email: "alex@mulerun.com", name: "Alex Chen", description: "CEO & Co-founder. Responsible for product vision, strategy, and team culture.", team_role: "owner" as const },
  { email: "sarah@mulerun.com", name: "Sarah Kim", description: "Product Manager. Owns the roadmap, user research, and feature prioritization.", team_role: "member" as const },
  { email: "mike@mulerun.com", name: "Mike Zhang", description: "Full-stack Engineer. Builds frontend and backend features, maintains infrastructure.", team_role: "member" as const },
  { email: "lisa@mulerun.com", name: "Lisa Wang", description: "UI/UX Designer. Creates design systems, prototypes, and user experience flows.", team_role: "member" as const },
];

const AGENTS_DATA: Omit<RegisteredAgent, "token_hash">[] = [
  {
    id: "cody",
    name: "Cody",
    description: "AI code assistant. Helps with code review, writing tests, refactoring, and pair programming.",
    capabilities: ["coding", "code-review", "testing", "refactoring"],
    created_at: daysAgo(20),
    last_seen_at: hoursAgo(1),
  },
  {
    id: "devin",
    name: "Devin",
    description: "DevOps agent. Manages CI/CD pipelines, deployment, monitoring, and infrastructure automation.",
    capabilities: ["deployment", "monitoring", "ci-cd", "infrastructure"],
    created_at: daysAgo(18),
    last_seen_at: hoursAgo(3),
  },
  {
    id: "scout",
    name: "Scout",
    description: "Research agent. Conducts market research, competitive analysis, user feedback synthesis, and report writing.",
    capabilities: ["research", "analysis", "writing", "data-synthesis"],
    created_at: daysAgo(15),
    last_seen_at: hoursAgo(6),
  },
];

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const sql = await db();
      await ensureMigrations();
      initRepo();

      const url = new URL(request.url);
      const locale = (url.searchParams.get("locale") === "en" ? "en" : "zh") as "en" | "zh";
      const L = getSeedLocale(locale);

      clearRepo();

      // ── 1. Create Human Users ──
      const passwordHash = await hashPassword("password123");
      const userIds: Record<string, string> = {};

      for (const human of HUMANS) {
        const existing = await sql`SELECT id FROM users WHERE email = ${human.email}` as { id: string }[];
        if (existing.length > 0) {
          userIds[human.name] = existing[0].id;
          continue;
        }
        const result = await sql`
          INSERT INTO users (email, password_hash, name, description, team_role)
          VALUES (${human.email}, ${passwordHash}, ${human.name}, ${human.description}, ${human.team_role})
          RETURNING id
        ` as { id: string }[];
        userIds[human.name] = result[0].id;
      }

      // ── 1b. Reset all existing users' passwords to password123 ──
      await sql`UPDATE users SET password_hash = ${passwordHash}`;

      // ── 2. Register Agents ──
      for (const agentData of AGENTS_DATA) {
        const agent: RegisteredAgent = {
          ...agentData,
          token_hash: crypto.createHash("sha256").update(`mock-token-${agentData.id}`).digest("hex"),
          created_by: { id: userIds["Alex Chen"], name: "Alex Chen" },
        };
        try {
          registerAgent(agent);
        } catch {
          // Agent may already exist
        }
      }

      // ── 3. Build Participant References ──
      const p = {
        alex: { id: `human:${userIds["Alex Chen"]}`, type: "human" as const, name: "Alex Chen" },
        sarah: { id: `human:${userIds["Sarah Kim"]}`, type: "human" as const, name: "Sarah Kim" },
        mike: { id: `human:${userIds["Mike Zhang"]}`, type: "human" as const, name: "Mike Zhang" },
        lisa: { id: `human:${userIds["Lisa Wang"]}`, type: "human" as const, name: "Lisa Wang" },
        cody: { id: "agent:cody", type: "agent" as const, name: "Cody" },
        devin: { id: "agent:devin", type: "agent" as const, name: "Devin" },
        scout: { id: "agent:scout", type: "agent" as const, name: "Scout" },
      };

      // ── 4. Create Channels ──
      const channels: ChannelMeta[] = [
        {
          id: "product",
          name: L.channels.product.name,
          description: L.channels.product.description,
          members: [p.alex, p.sarah, p.lisa, p.scout],
          created_by: p.alex.id,
          created_at: daysAgo(25),
          updated_at: hoursAgo(2),
        },
        {
          id: "engineering",
          name: L.channels.engineering.name,
          description: L.channels.engineering.description,
          members: [p.alex, p.mike, p.cody, p.devin],
          created_by: p.mike.id,
          created_at: daysAgo(25),
          updated_at: hoursAgo(1),
        },
        {
          id: "general",
          name: L.channels.general.name,
          description: L.channels.general.description,
          members: [p.alex, p.sarah, p.mike, p.lisa, p.cody, p.devin, p.scout],
          created_by: p.alex.id,
          created_at: daysAgo(25),
          updated_at: hoursAgo(4),
        },
        {
          id: "design",
          name: L.channels.design.name,
          description: L.channels.design.description,
          members: [p.lisa, p.sarah, p.alex, p.cody],
          created_by: p.lisa.id,
          created_at: daysAgo(24),
          updated_at: hoursAgo(6),
        },
        {
          id: "ops",
          name: L.channels.ops.name,
          description: L.channels.ops.description,
          members: [p.devin, p.mike, p.alex],
          created_by: p.devin.id,
          created_at: daysAgo(24),
          updated_at: hoursAgo(2),
        },
      ];

      for (const ch of channels) {
        try {
          createChannel(ch);
        } catch {
          // Channel may already exist
        }
      }

      // ── 5. Create Threads with Messages ──

      // --- Thread 1: Q2 Roadmap ---
      createThreadWithMessages(
        {
          id: "q2-roadmap",
          title: L.threads["q2-roadmap"].title,
          description: L.threads["q2-roadmap"].description,
          status: "in_progress",
          status_label: L.threads["q2-roadmap"].status_label,
          status_detail: L.threads["q2-roadmap"].status_detail,
          participants: [p.alex, p.sarah, p.scout],
          channel_id: "product",
          created_by: p.sarah.id,
          created_at: daysAgo(5),
          updated_at: hoursAgo(3),
        },
        [
          { from: p.sarah, body: L.messages["q2-roadmap"][0], hoursAgo: 96 },
          { from: p.scout, body: L.messages["q2-roadmap"][1], hoursAgo: 90 },
          { from: p.alex, body: L.messages["q2-roadmap"][2], hoursAgo: 72 },
          { from: p.sarah, body: L.messages["q2-roadmap"][3], hoursAgo: 48 },
          { from: p.alex, body: L.messages["q2-roadmap"][4], hoursAgo: 24 },
          { from: p.sarah, body: L.messages["q2-roadmap"][5], hoursAgo: 3 },
        ],
        [
          { description: L.tasks["q2-roadmap"][0], assignee: p.sarah, status: "in_progress" as const, created_by: p.alex },
          { description: L.tasks["q2-roadmap"][1], assignee: p.sarah, status: "open" as const, created_by: p.alex },
          { description: L.tasks["q2-roadmap"][2], assignee: p.scout, status: "done" as const, created_by: p.sarah },
        ],
        [
          { url: "https://www.notion.so/mulerun/Q2-Roadmap-Draft", title: L.links["q2-roadmap"][0], type: "reference" as const },
        ]
      );

      // --- Thread 2: User Feedback ---
      createThreadWithMessages(
        {
          id: "user-feedback-march",
          title: L.threads["user-feedback-march"].title,
          description: L.threads["user-feedback-march"].description,
          status: "in_progress",
          status_label: L.threads["user-feedback-march"].status_label,
          status_detail: L.threads["user-feedback-march"].status_detail,
          participants: [p.sarah, p.lisa, p.scout],
          channel_id: "product",
          created_by: p.sarah.id,
          created_at: daysAgo(7),
          updated_at: hoursAgo(8),
        },
        [
          { from: p.sarah, body: L.messages["user-feedback-march"][0], hoursAgo: 120 },
          { from: p.scout, body: L.messages["user-feedback-march"][1], hoursAgo: 110 },
          { from: p.lisa, body: L.messages["user-feedback-march"][2], hoursAgo: 96 },
          { from: p.sarah, body: L.messages["user-feedback-march"][3], hoursAgo: 48 },
          { from: p.lisa, body: L.messages["user-feedback-march"][4], hoursAgo: 8 },
        ],
        [
          { description: L.tasks["user-feedback-march"][0], assignee: p.lisa, status: "in_progress" as const, created_by: p.sarah },
          { description: L.tasks["user-feedback-march"][1], assignee: p.lisa, status: "open" as const, created_by: p.sarah },
        ],
        []
      );

      // --- Thread 3: API v2 Refactor ---
      createThreadWithMessages(
        {
          id: "api-v2-refactor",
          title: L.threads["api-v2-refactor"].title,
          description: L.threads["api-v2-refactor"].description,
          status: "in_progress",
          status_label: L.threads["api-v2-refactor"].status_label,
          status_detail: L.threads["api-v2-refactor"].status_detail,
          participants: [p.mike, p.cody, p.alex],
          channel_id: "engineering",
          created_by: p.mike.id,
          created_at: daysAgo(4),
          updated_at: hoursAgo(2),
        },
        [
          { from: p.mike, body: L.messages["api-v2-refactor"][0], hoursAgo: 72 },
          { from: p.cody, body: L.messages["api-v2-refactor"][1], hoursAgo: 68 },
          { from: p.mike, body: L.messages["api-v2-refactor"][2], hoursAgo: 48 },
          { from: p.cody, body: L.messages["api-v2-refactor"][3], hoursAgo: 24 },
          { from: p.alex, body: L.messages["api-v2-refactor"][4], hoursAgo: 12 },
          { from: p.mike, body: L.messages["api-v2-refactor"][5], hoursAgo: 2 },
        ],
        [
          { description: L.tasks["api-v2-refactor"][0], assignee: p.mike, status: "in_progress" as const, created_by: p.mike },
          { description: L.tasks["api-v2-refactor"][1], assignee: p.mike, status: "open" as const, created_by: p.mike },
          { description: L.tasks["api-v2-refactor"][2], assignee: p.cody, status: "open" as const, created_by: p.mike },
          { description: L.tasks["api-v2-refactor"][3], assignee: p.cody, status: "open" as const, created_by: p.mike },
        ],
        [
          { url: "https://github.com/mulerun/mule-team/tree/feat/git-queue", title: L.links["api-v2-refactor"][0], type: "reference" as const },
        ]
      );

      // --- Thread 4: CI/CD Pipeline ---
      createThreadWithMessages(
        {
          id: "cicd-optimization",
          title: L.threads["cicd-optimization"].title,
          description: L.threads["cicd-optimization"].description,
          status: "in_progress",
          status_label: L.threads["cicd-optimization"].status_label,
          status_detail: L.threads["cicd-optimization"].status_detail,
          participants: [p.mike, p.devin],
          channel_id: "engineering",
          created_by: p.mike.id,
          created_at: daysAgo(3),
          updated_at: hoursAgo(5),
        },
        [
          { from: p.mike, body: L.messages["cicd-optimization"][0], hoursAgo: 60 },
          { from: p.devin, body: L.messages["cicd-optimization"][1], hoursAgo: 55 },
          { from: p.mike, body: L.messages["cicd-optimization"][2], hoursAgo: 50 },
          { from: p.devin, body: L.messages["cicd-optimization"][3], hoursAgo: 30 },
          { from: p.mike, body: L.messages["cicd-optimization"][4], hoursAgo: 5 },
        ],
        [
          { description: L.tasks["cicd-optimization"][0], assignee: p.devin, status: "done" as const, created_by: p.mike },
          { description: L.tasks["cicd-optimization"][1], assignee: p.devin, status: "in_progress" as const, created_by: p.mike },
          { description: L.tasks["cicd-optimization"][2], assignee: p.devin, status: "open" as const, created_by: p.mike },
        ],
        []
      );

      // --- Thread 5: Homepage Performance ---
      createThreadWithMessages(
        {
          id: "homepage-perf",
          title: L.threads["homepage-perf"].title,
          description: L.threads["homepage-perf"].description,
          status: "open",
          status_label: L.threads["homepage-perf"].status_label,
          status_detail: L.threads["homepage-perf"].status_detail,
          participants: [p.mike, p.lisa, p.cody],
          channel_id: "engineering",
          created_by: p.lisa.id,
          created_at: daysAgo(2),
          updated_at: hoursAgo(10),
        },
        [
          { from: p.lisa, body: L.messages["homepage-perf"][0], hoursAgo: 36 },
          { from: p.mike, body: L.messages["homepage-perf"][1], hoursAgo: 30 },
          { from: p.cody, body: L.messages["homepage-perf"][2], hoursAgo: 20 },
          { from: p.mike, body: L.messages["homepage-perf"][3], hoursAgo: 10 },
        ],
        [
          { description: L.tasks["homepage-perf"][0], assignee: p.mike, status: "open" as const, created_by: p.mike },
          { description: L.tasks["homepage-perf"][1], assignee: p.cody, status: "open" as const, created_by: p.mike },
        ],
        []
      );

      // --- Thread 6: Weekly Standup ---
      createThreadWithMessages(
        {
          id: "weekly-standup-w13",
          title: L.threads["weekly-standup-w13"].title,
          description: L.threads["weekly-standup-w13"].description,
          status: "in_progress",
          status_label: L.threads["weekly-standup-w13"].status_label,
          status_detail: L.threads["weekly-standup-w13"].status_detail,
          participants: [p.alex, p.sarah, p.mike, p.lisa, p.cody, p.devin],
          channel_id: "general",
          created_by: p.alex.id,
          created_at: daysAgo(1),
          updated_at: hoursAgo(4),
        },
        [
          { from: p.alex, body: L.messages["weekly-standup-w13"][0], hoursAgo: 28 },
          { from: p.sarah, body: L.messages["weekly-standup-w13"][1], hoursAgo: 26 },
          { from: p.mike, body: L.messages["weekly-standup-w13"][2], hoursAgo: 24 },
          { from: p.lisa, body: L.messages["weekly-standup-w13"][3], hoursAgo: 22 },
          { from: p.cody, body: L.messages["weekly-standup-w13"][4], hoursAgo: 20 },
          { from: p.devin, body: L.messages["weekly-standup-w13"][5], hoursAgo: 18 },
          { from: p.alex, body: L.messages["weekly-standup-w13"][6], hoursAgo: 4 },
        ],
        [],
        []
      );

      // --- Thread 7: Onboarding Checklist ---
      createThreadWithMessages(
        {
          id: "onboarding-checklist",
          title: L.threads["onboarding-checklist"].title,
          description: L.threads["onboarding-checklist"].description,
          status: "open",
          status_label: L.threads["onboarding-checklist"].status_label,
          status_detail: L.threads["onboarding-checklist"].status_detail,
          participants: [p.alex, p.sarah],
          channel_id: "general",
          created_by: p.alex.id,
          created_at: daysAgo(10),
          updated_at: hoursAgo(48),
        },
        [
          { from: p.alex, body: L.messages["onboarding-checklist"][0], hoursAgo: 200 },
          { from: p.sarah, body: L.messages["onboarding-checklist"][1], hoursAgo: 180 },
          { from: p.alex, body: L.messages["onboarding-checklist"][2], hoursAgo: 48 },
        ],
        [
          { description: L.tasks["onboarding-checklist"][0], assignee: p.alex, status: "open" as const, created_by: p.alex },
          { description: L.tasks["onboarding-checklist"][1], assignee: p.sarah, status: "open" as const, created_by: p.alex },
        ],
        [
          { url: "https://www.notion.so/mulerun/Security-Training", title: L.links["onboarding-checklist"][0], type: "reference" as const },
          { url: "https://github.com/mulerun/mule-team/wiki/Dev-Setup", title: L.links["onboarding-checklist"][1], type: "reference" as const },
        ]
      );

      // --- Thread 8: Brand Guidelines (done) ---
      createThreadWithMessages(
        {
          id: "brand-guidelines",
          title: L.threads["brand-guidelines"].title,
          description: L.threads["brand-guidelines"].description,
          status: "done",
          status_label: L.threads["brand-guidelines"].status_label,
          status_detail: L.threads["brand-guidelines"].status_detail,
          participants: [p.lisa, p.alex, p.sarah],
          channel_id: "product",
          created_by: p.lisa.id,
          created_at: daysAgo(14),
          updated_at: daysAgo(3),
        },
        [
          { from: p.lisa, body: L.messages["brand-guidelines"][0], hoursAgo: 250 },
          { from: p.alex, body: L.messages["brand-guidelines"][1], hoursAgo: 240 },
          { from: p.lisa, body: L.messages["brand-guidelines"][2], hoursAgo: 220 },
          { from: p.sarah, body: L.messages["brand-guidelines"][3], hoursAgo: 72 },
        ],
        [
          { description: L.tasks["brand-guidelines"][0], assignee: p.lisa, status: "done" as const, created_by: p.alex },
          { description: L.tasks["brand-guidelines"][1], assignee: p.lisa, status: "done" as const, created_by: p.alex },
        ],
        [
          { url: "https://www.figma.com/file/mulerun-brand-v2", title: L.links["brand-guidelines"][0], type: "reference" as const },
        ]
      );

      // --- Thread 9: Security Audit (done) ---
      createThreadWithMessages(
        {
          id: "security-audit-q1",
          title: L.threads["security-audit-q1"].title,
          description: L.threads["security-audit-q1"].description,
          status: "done",
          status_label: L.threads["security-audit-q1"].status_label,
          status_detail: L.threads["security-audit-q1"].status_detail,
          participants: [p.mike, p.devin, p.alex],
          channel_id: "engineering",
          created_by: p.alex.id,
          created_at: daysAgo(20),
          updated_at: daysAgo(7),
        },
        [
          { from: p.alex, body: L.messages["security-audit-q1"][0], hoursAgo: 400 },
          { from: p.mike, body: L.messages["security-audit-q1"][1], hoursAgo: 380 },
          { from: p.devin, body: L.messages["security-audit-q1"][2], hoursAgo: 370 },
          { from: p.mike, body: L.messages["security-audit-q1"][3], hoursAgo: 300 },
          { from: p.devin, body: L.messages["security-audit-q1"][4], hoursAgo: 168 },
        ],
        [
          { description: L.tasks["security-audit-q1"][0], assignee: p.mike, status: "done" as const, created_by: p.alex },
          { description: L.tasks["security-audit-q1"][1], assignee: p.devin, status: "done" as const, created_by: p.alex },
          { description: L.tasks["security-audit-q1"][2], assignee: p.devin, status: "done" as const, created_by: p.alex },
        ],
        []
      );

      // --- Thread 10: Launch Checklist (archived) ---
      createThreadWithMessages(
        {
          id: "launch-checklist-v1",
          title: L.threads["launch-checklist-v1"].title,
          description: L.threads["launch-checklist-v1"].description,
          status: "archived",
          status_label: L.threads["launch-checklist-v1"].status_label,
          status_detail: L.threads["launch-checklist-v1"].status_detail,
          participants: [p.alex, p.sarah, p.mike, p.lisa, p.devin],
          channel_id: "general",
          created_by: p.alex.id,
          created_at: daysAgo(45),
          updated_at: daysAgo(30),
        },
        [
          { from: p.alex, body: L.messages["launch-checklist-v1"][0], hoursAgo: 1080 },
          { from: p.lisa, body: L.messages["launch-checklist-v1"][1], hoursAgo: 960 },
          { from: p.mike, body: L.messages["launch-checklist-v1"][2], hoursAgo: 900 },
          { from: p.devin, body: L.messages["launch-checklist-v1"][3], hoursAgo: 850 },
          { from: p.sarah, body: L.messages["launch-checklist-v1"][4], hoursAgo: 800 },
          { from: p.alex, body: L.messages["launch-checklist-v1"][5], hoursAgo: 720 },
        ],
        [
          { description: L.tasks["launch-checklist-v1"][0], assignee: p.lisa, status: "done" as const, created_by: p.alex },
          { description: L.tasks["launch-checklist-v1"][1], assignee: p.mike, status: "done" as const, created_by: p.alex },
          { description: L.tasks["launch-checklist-v1"][2], assignee: p.devin, status: "done" as const, created_by: p.alex },
          { description: L.tasks["launch-checklist-v1"][3], assignee: p.sarah, status: "done" as const, created_by: p.alex },
          { description: L.tasks["launch-checklist-v1"][4], assignee: p.devin, status: "done" as const, created_by: p.alex },
        ],
        []
      );

      // --- Thread 11: Design System Migration (archived) ---
      createThreadWithMessages(
        {
          id: "design-system-migration",
          title: L.threads["design-system-migration"].title,
          description: L.threads["design-system-migration"].description,
          status: "archived",
          status_label: L.threads["design-system-migration"].status_label,
          status_detail: L.threads["design-system-migration"].status_detail,
          participants: [p.lisa, p.mike, p.cody],
          channel_id: "engineering",
          created_by: p.lisa.id,
          created_at: daysAgo(35),
          updated_at: daysAgo(15),
        },
        [
          { from: p.lisa, body: L.messages["design-system-migration"][0], hoursAgo: 840 },
          { from: p.mike, body: L.messages["design-system-migration"][1], hoursAgo: 820 },
          { from: p.cody, body: L.messages["design-system-migration"][2], hoursAgo: 800 },
          { from: p.cody, body: L.messages["design-system-migration"][3], hoursAgo: 700 },
          { from: p.lisa, body: L.messages["design-system-migration"][4], hoursAgo: 360 },
        ],
        [
          { description: L.tasks["design-system-migration"][0], assignee: p.lisa, status: "done" as const, created_by: p.lisa },
          { description: L.tasks["design-system-migration"][1], assignee: p.cody, status: "done" as const, created_by: p.mike },
          { description: L.tasks["design-system-migration"][2], assignee: p.lisa, status: "done" as const, created_by: p.mike },
        ],
        []
      );

      // --- Thread 12: Mobile App Discussion (open, no messages yet) ---
      createThreadWithMessages(
        {
          id: "mobile-app-discussion",
          title: L.threads["mobile-app-discussion"].title,
          description: L.threads["mobile-app-discussion"].description,
          status: "open",
          status_label: L.threads["mobile-app-discussion"].status_label,
          status_detail: L.threads["mobile-app-discussion"].status_detail,
          participants: [p.alex, p.sarah, p.mike],
          channel_id: "product",
          created_by: p.sarah.id,
          created_at: daysAgo(1),
          updated_at: hoursAgo(12),
        },
        [
          { from: p.sarah, body: L.messages["mobile-app-discussion"][0], hoursAgo: 12 },
        ],
        [],
        []
      );

      // --- Thread 13: Design System Component Audit ---
      createThreadWithMessages(
        {
          id: "ds-component-audit",
          title: L.threads["ds-component-audit"].title,
          description: L.threads["ds-component-audit"].description,
          status: "in_progress",
          status_label: L.threads["ds-component-audit"].status_label,
          status_detail: L.threads["ds-component-audit"].status_detail,
          participants: [p.lisa, p.mike, p.cody],
          channel_id: "design",
          created_by: p.lisa.id,
          created_at: daysAgo(3),
          updated_at: hoursAgo(6),
        },
        [
          { from: p.lisa, body: L.messages["ds-component-audit"][0], hoursAgo: 48 },
          { from: p.cody, body: L.messages["ds-component-audit"][1], hoursAgo: 40 },
          { from: p.lisa, body: L.messages["ds-component-audit"][2], hoursAgo: 36 },
          { from: p.mike, body: L.messages["ds-component-audit"][3], hoursAgo: 20 },
          { from: p.lisa, body: L.messages["ds-component-audit"][4], hoursAgo: 6 },
        ],
        [
          { description: L.tasks["ds-component-audit"][0], assignee: p.cody, status: "in_progress" as const, created_by: p.lisa },
          { description: L.tasks["ds-component-audit"][1], assignee: p.lisa, status: "open" as const, created_by: p.lisa },
          { description: L.tasks["ds-component-audit"][2], assignee: p.lisa, status: "open" as const, created_by: p.lisa },
          { description: L.tasks["ds-component-audit"][3], assignee: p.cody, status: "open" as const, created_by: p.mike },
        ],
        [
          { url: "https://www.figma.com/file/mulerun-ds-v2/components", title: L.links["ds-component-audit"][0], type: "reference" as const },
        ]
      );

      // --- Thread 14: Dark Mode Visual QA ---
      createThreadWithMessages(
        {
          id: "dark-mode-qa",
          title: L.threads["dark-mode-qa"].title,
          description: L.threads["dark-mode-qa"].description,
          status: "open",
          status_label: L.threads["dark-mode-qa"].status_label,
          status_detail: L.threads["dark-mode-qa"].status_detail,
          participants: [p.lisa, p.sarah, p.cody],
          channel_id: "design",
          created_by: p.lisa.id,
          created_at: daysAgo(2),
          updated_at: hoursAgo(14),
        },
        [
          { from: p.lisa, body: L.messages["dark-mode-qa"][0], hoursAgo: 36 },
          { from: p.cody, body: L.messages["dark-mode-qa"][1], hoursAgo: 30 },
          { from: p.lisa, body: L.messages["dark-mode-qa"][2], hoursAgo: 14 },
        ],
        [
          { description: L.tasks["dark-mode-qa"][0], assignee: p.cody, status: "open" as const, created_by: p.lisa },
          { description: L.tasks["dark-mode-qa"][1], assignee: p.lisa, status: "open" as const, created_by: p.lisa },
        ],
        []
      );

      // --- Thread 15: Production Monitoring Dashboard ---
      createThreadWithMessages(
        {
          id: "prod-monitoring",
          title: L.threads["prod-monitoring"].title,
          description: L.threads["prod-monitoring"].description,
          status: "in_progress",
          status_label: L.threads["prod-monitoring"].status_label,
          status_detail: L.threads["prod-monitoring"].status_detail,
          participants: [p.devin, p.mike, p.alex],
          channel_id: "ops",
          created_by: p.devin.id,
          created_at: daysAgo(6),
          updated_at: hoursAgo(2),
        },
        [
          { from: p.devin, body: L.messages["prod-monitoring"][0], hoursAgo: 120 },
          { from: p.mike, body: L.messages["prod-monitoring"][1], hoursAgo: 100 },
          { from: p.devin, body: L.messages["prod-monitoring"][2], hoursAgo: 80 },
          { from: p.alex, body: L.messages["prod-monitoring"][3], hoursAgo: 48 },
          { from: p.devin, body: L.messages["prod-monitoring"][4], hoursAgo: 24 },
          { from: p.mike, body: L.messages["prod-monitoring"][5], hoursAgo: 2 },
        ],
        [
          { description: L.tasks["prod-monitoring"][0], assignee: p.mike, status: "done" as const, created_by: p.devin },
          { description: L.tasks["prod-monitoring"][1], assignee: p.devin, status: "in_progress" as const, created_by: p.devin },
          { description: L.tasks["prod-monitoring"][2], assignee: p.devin, status: "done" as const, created_by: p.alex },
          { description: L.tasks["prod-monitoring"][3], assignee: p.devin, status: "open" as const, created_by: p.alex },
        ],
        [
          { url: "https://grafana.mulerun.internal/d/prod-overview", title: L.links["prod-monitoring"][0], type: "reference" as const },
          { url: "https://mulerun.pagerduty.com/schedules", title: L.links["prod-monitoring"][1], type: "reference" as const },
        ]
      );

      // --- Thread 16: Incident Post-Mortem ---
      createThreadWithMessages(
        {
          id: "incident-mar28",
          title: L.threads["incident-mar28"].title,
          description: L.threads["incident-mar28"].description,
          status: "done",
          status_label: L.threads["incident-mar28"].status_label,
          status_detail: L.threads["incident-mar28"].status_detail,
          participants: [p.devin, p.mike, p.alex],
          channel_id: "ops",
          created_by: p.devin.id,
          created_at: daysAgo(4),
          updated_at: daysAgo(2),
        },
        [
          { from: p.devin, body: L.messages["incident-mar28"][0], hoursAgo: 96 },
          { from: p.mike, body: L.messages["incident-mar28"][1], hoursAgo: 90 },
          { from: p.alex, body: L.messages["incident-mar28"][2], hoursAgo: 80 },
          { from: p.devin, body: L.messages["incident-mar28"][3], hoursAgo: 72 },
          { from: p.alex, body: L.messages["incident-mar28"][4], hoursAgo: 48 },
        ],
        [
          { description: L.tasks["incident-mar28"][0], assignee: p.devin, status: "done" as const, created_by: p.devin },
          { description: L.tasks["incident-mar28"][1], assignee: p.devin, status: "in_progress" as const, created_by: p.devin },
          { description: L.tasks["incident-mar28"][2], assignee: p.mike, status: "open" as const, created_by: p.devin },
          { description: L.tasks["incident-mar28"][3], assignee: p.devin, status: "open" as const, created_by: p.alex },
        ],
        [
          { url: "https://grafana.mulerun.internal/d/incident-mar28", title: L.links["incident-mar28"][0], type: "reference" as const },
        ]
      );

      // --- Thread 17: Accessibility Improvements ---
      createThreadWithMessages(
        {
          id: "a11y-improvements",
          title: L.threads["a11y-improvements"].title,
          description: L.threads["a11y-improvements"].description,
          status: "in_progress",
          status_label: L.threads["a11y-improvements"].status_label,
          status_detail: L.threads["a11y-improvements"].status_detail,
          participants: [p.lisa, p.mike, p.cody, p.sarah],
          channel_id: "design",
          created_by: p.sarah.id,
          created_at: daysAgo(3),
          updated_at: hoursAgo(8),
        },
        [
          { from: p.sarah, body: L.messages["a11y-improvements"][0], hoursAgo: 60 },
          { from: p.lisa, body: L.messages["a11y-improvements"][1], hoursAgo: 50 },
          { from: p.mike, body: L.messages["a11y-improvements"][2], hoursAgo: 44 },
          { from: p.cody, body: L.messages["a11y-improvements"][3], hoursAgo: 38 },
          { from: p.sarah, body: L.messages["a11y-improvements"][4], hoursAgo: 8 },
        ],
        [
          { description: L.tasks["a11y-improvements"][0], assignee: p.lisa, status: "in_progress" as const, created_by: p.sarah },
          { description: L.tasks["a11y-improvements"][1], assignee: p.mike, status: "in_progress" as const, created_by: p.sarah },
          { description: L.tasks["a11y-improvements"][2], assignee: p.mike, status: "open" as const, created_by: p.mike },
          { description: L.tasks["a11y-improvements"][3], assignee: p.cody, status: "in_progress" as const, created_by: p.mike },
          { description: L.tasks["a11y-improvements"][4], assignee: p.cody, status: "open" as const, created_by: p.mike },
          { description: L.tasks["a11y-improvements"][5], assignee: p.cody, status: "open" as const, created_by: p.mike },
        ],
        []
      );

      // --- Thread 18: Agent SDK Documentation ---
      createThreadWithMessages(
        {
          id: "agent-sdk-docs",
          title: L.threads["agent-sdk-docs"].title,
          description: L.threads["agent-sdk-docs"].description,
          status: "in_progress",
          status_label: L.threads["agent-sdk-docs"].status_label,
          status_detail: L.threads["agent-sdk-docs"].status_detail,
          participants: [p.sarah, p.mike, p.cody, p.scout],
          channel_id: "product",
          created_by: p.sarah.id,
          created_at: daysAgo(5),
          updated_at: hoursAgo(10),
        },
        [
          { from: p.sarah, body: L.messages["agent-sdk-docs"][0], hoursAgo: 100 },
          { from: p.scout, body: L.messages["agent-sdk-docs"][1], hoursAgo: 88 },
          { from: p.mike, body: L.messages["agent-sdk-docs"][2], hoursAgo: 72 },
          { from: p.cody, body: L.messages["agent-sdk-docs"][3], hoursAgo: 60 },
          { from: p.sarah, body: L.messages["agent-sdk-docs"][4], hoursAgo: 10 },
        ],
        [
          { description: L.tasks["agent-sdk-docs"][0], assignee: p.mike, status: "in_progress" as const, created_by: p.sarah },
          { description: L.tasks["agent-sdk-docs"][1], assignee: p.cody, status: "in_progress" as const, created_by: p.mike },
          { description: L.tasks["agent-sdk-docs"][2], assignee: p.cody, status: "open" as const, created_by: p.sarah },
          { description: L.tasks["agent-sdk-docs"][3], assignee: p.scout, status: "open" as const, created_by: p.sarah },
          { description: L.tasks["agent-sdk-docs"][4], assignee: p.scout, status: "done" as const, created_by: p.sarah },
        ],
        [
          { url: "https://docs.mulerun.com/agents", title: L.links["agent-sdk-docs"][0], type: "reference" as const },
          { url: "https://github.com/mulerun/agent-sdk", title: L.links["agent-sdk-docs"][1], type: "reference" as const },
        ]
      );

      // ── 6. Seed notification events for all human users ──
      const allHumanIds = Object.values(userIds);
      const eventRows: { user_id: string; type: string; thread_id: string; thread_title: string; message_id: string | null; actor_id: string; actor_name: string; body: string | null; hours_ago: number }[] = [
        // Mentions
        { user_id: p.alex.id, type: "mention", thread_id: "q2-roadmap", thread_title: L.events.threadTitles["q2-roadmap"], message_id: "m1", actor_id: p.sarah.id, actor_name: "Sarah Kim", body: L.events.bodies["mention:q2-roadmap:alex"], hours_ago: 3 },
        { user_id: p.mike.id, type: "mention", thread_id: "homepage-perf", thread_title: L.events.threadTitles["homepage-perf"], message_id: "m2", actor_id: p.lisa.id, actor_name: "Lisa Wang", body: L.events.bodies["mention:homepage-perf:mike"], hours_ago: 36 },
        { user_id: p.mike.id, type: "mention", thread_id: "api-v2-refactor", thread_title: L.events.threadTitles["api-v2-refactor"], message_id: "m3", actor_id: p.cody.id, actor_name: "Cody", body: L.events.bodies["mention:api-v2-refactor:mike"], hours_ago: 24 },
        // Replies
        { user_id: p.sarah.id, type: "reply", thread_id: "q2-roadmap", thread_title: L.events.threadTitles["q2-roadmap"], message_id: "m4", actor_id: p.alex.id, actor_name: "Alex Chen", body: L.events.bodies["reply:q2-roadmap:sarah"], hours_ago: 24 },
        { user_id: p.alex.id, type: "reply", thread_id: "onboarding-checklist", thread_title: L.events.threadTitles["onboarding-checklist"], message_id: "m5", actor_id: p.sarah.id, actor_name: "Sarah Kim", body: L.events.bodies["reply:onboarding-checklist:alex"], hours_ago: 180 },
        { user_id: p.lisa.id, type: "reply", thread_id: "user-feedback-march", thread_title: L.events.threadTitles["user-feedback-march"], message_id: "m6", actor_id: p.sarah.id, actor_name: "Sarah Kim", body: L.events.bodies["reply:user-feedback-march:lisa"], hours_ago: 48 },
        // Joins
        { user_id: p.alex.id, type: "join", thread_id: "api-v2-refactor", thread_title: L.events.threadTitles["api-v2-refactor"], message_id: null, actor_id: p.mike.id, actor_name: "Mike Zhang", body: null, hours_ago: 12 },
        { user_id: p.mike.id, type: "join", thread_id: "weekly-standup-w13", thread_title: L.events.threadTitles["weekly-standup-w13"], message_id: null, actor_id: p.alex.id, actor_name: "Alex Chen", body: null, hours_ago: 28 },
        { user_id: p.sarah.id, type: "join", thread_id: "weekly-standup-w13", thread_title: L.events.threadTitles["weekly-standup-w13"], message_id: null, actor_id: p.alex.id, actor_name: "Alex Chen", body: null, hours_ago: 28 },
        // Status changes
        { user_id: p.mike.id, type: "status_change", thread_id: "cicd-optimization", thread_title: L.events.threadTitles["cicd-optimization"], message_id: null, actor_id: p.devin.id, actor_name: "Devin", body: L.events.bodies["status_change:cicd-optimization:mike"], hours_ago: 5 },
        { user_id: p.sarah.id, type: "status_change", thread_id: "user-feedback-march", thread_title: L.events.threadTitles["user-feedback-march"], message_id: null, actor_id: p.scout.id, actor_name: "Scout", body: L.events.bodies["status_change:user-feedback-march:sarah"], hours_ago: 8 },
        // Task assigned
        { user_id: p.sarah.id, type: "task_assigned", thread_id: "q2-roadmap", thread_title: L.events.threadTitles["q2-roadmap"], message_id: null, actor_id: p.alex.id, actor_name: "Alex Chen", body: L.events.bodies["task_assigned:q2-roadmap:sarah"], hours_ago: 24 },
        { user_id: p.mike.id, type: "task_assigned", thread_id: "homepage-perf", thread_title: L.events.threadTitles["homepage-perf"], message_id: null, actor_id: p.mike.id, actor_name: "Mike Zhang", body: L.events.bodies["task_assigned:homepage-perf:mike"], hours_ago: 10 },
        { user_id: p.lisa.id, type: "task_assigned", thread_id: "user-feedback-march", thread_title: L.events.threadTitles["user-feedback-march"], message_id: null, actor_id: p.sarah.id, actor_name: "Sarah Kim", body: L.events.bodies["task_assigned:user-feedback-march:lisa"], hours_ago: 96 },
        // Task done
        { user_id: p.mike.id, type: "task_done", thread_id: "cicd-optimization", thread_title: L.events.threadTitles["cicd-optimization"], message_id: null, actor_id: p.devin.id, actor_name: "Devin", body: L.events.bodies["task_done:cicd-optimization:mike"], hours_ago: 30 },
        { user_id: p.sarah.id, type: "task_done", thread_id: "q2-roadmap", thread_title: L.events.threadTitles["q2-roadmap"], message_id: null, actor_id: p.scout.id, actor_name: "Scout", body: L.events.bodies["task_done:q2-roadmap:sarah"], hours_ago: 90 },
        // Events for new threads
        { user_id: p.mike.id, type: "mention", thread_id: "ds-component-audit", thread_title: L.events.threadTitles["ds-component-audit"], message_id: "m9", actor_id: p.lisa.id, actor_name: "Lisa Wang", body: L.events.bodies["mention:ds-component-audit:mike"], hours_ago: 48 },
        { user_id: p.lisa.id, type: "task_assigned", thread_id: "dark-mode-qa", thread_title: L.events.threadTitles["dark-mode-qa"], message_id: null, actor_id: p.lisa.id, actor_name: "Lisa Wang", body: L.events.bodies["task_assigned:dark-mode-qa:lisa"], hours_ago: 14 },
        { user_id: p.mike.id, type: "mention", thread_id: "prod-monitoring", thread_title: L.events.threadTitles["prod-monitoring"], message_id: "m10", actor_id: p.devin.id, actor_name: "Devin", body: L.events.bodies["mention:prod-monitoring:mike"], hours_ago: 120 },
        { user_id: p.alex.id, type: "reply", thread_id: "incident-mar28", thread_title: L.events.threadTitles["incident-mar28"], message_id: "m11", actor_id: p.devin.id, actor_name: "Devin", body: L.events.bodies["reply:incident-mar28:alex"], hours_ago: 72 },
        { user_id: p.mike.id, type: "task_done", thread_id: "prod-monitoring", thread_title: L.events.threadTitles["prod-monitoring"], message_id: null, actor_id: p.mike.id, actor_name: "Mike Zhang", body: L.events.bodies["task_done:prod-monitoring:mike"], hours_ago: 2 },
        { user_id: p.sarah.id, type: "mention", thread_id: "a11y-improvements", thread_title: L.events.threadTitles["a11y-improvements"], message_id: "m12", actor_id: p.lisa.id, actor_name: "Lisa Wang", body: L.events.bodies["mention:a11y-improvements:sarah"], hours_ago: 50 },
        { user_id: p.mike.id, type: "task_assigned", thread_id: "a11y-improvements", thread_title: L.events.threadTitles["a11y-improvements"], message_id: null, actor_id: p.sarah.id, actor_name: "Sarah Kim", body: L.events.bodies["task_assigned:a11y-improvements:mike"], hours_ago: 44 },
        { user_id: p.sarah.id, type: "reply", thread_id: "agent-sdk-docs", thread_title: L.events.threadTitles["agent-sdk-docs"], message_id: "m13", actor_id: p.scout.id, actor_name: "Scout", body: L.events.bodies["reply:agent-sdk-docs:sarah"], hours_ago: 88 },
        { user_id: p.alex.id, type: "status_change", thread_id: "incident-mar28", thread_title: L.events.threadTitles["incident-mar28"], message_id: null, actor_id: p.devin.id, actor_name: "Devin", body: L.events.bodies["status_change:incident-mar28:alex"], hours_ago: 48 },
      ];

      // Also generate events for Admin user targeting them
      const adminId = `human:${userIds["Admin"] || allHumanIds[0]}`;
      if (userIds["Admin"]) {
        eventRows.push(
          { user_id: adminId, type: "mention", thread_id: "weekly-standup-w13", thread_title: L.events.threadTitles["weekly-standup-w13"], message_id: "m7", actor_id: p.sarah.id, actor_name: "Sarah Kim", body: L.events.bodies["mention:weekly-standup-w13:admin"], hours_ago: 20 },
          { user_id: adminId, type: "reply", thread_id: "q2-roadmap", thread_title: L.events.threadTitles["q2-roadmap"], message_id: "m8", actor_id: p.alex.id, actor_name: "Alex Chen", body: L.events.bodies["reply:q2-roadmap:admin"], hours_ago: 6 },
          { user_id: adminId, type: "join", thread_id: "q2-roadmap", thread_title: L.events.threadTitles["q2-roadmap"], message_id: null, actor_id: p.sarah.id, actor_name: "Sarah Kim", body: null, hours_ago: 48 },
          { user_id: adminId, type: "task_assigned", thread_id: "onboarding-checklist", thread_title: L.events.threadTitles["onboarding-checklist"], message_id: null, actor_id: p.alex.id, actor_name: "Alex Chen", body: L.events.bodies["task_assigned:onboarding-checklist:admin"], hours_ago: 12 },
          { user_id: adminId, type: "task_done", thread_id: "api-v2-refactor", thread_title: L.events.threadTitles["api-v2-refactor"], message_id: null, actor_id: p.cody.id, actor_name: "Cody", body: L.events.bodies["task_done:api-v2-refactor:admin"], hours_ago: 18 },
          { user_id: adminId, type: "status_change", thread_id: "homepage-perf", thread_title: L.events.threadTitles["homepage-perf"], message_id: null, actor_id: p.mike.id, actor_name: "Mike Zhang", body: L.events.bodies["status_change:homepage-perf:admin"], hours_ago: 10 },
        );
      }

      for (const ev of eventRows) {
        const id = `evt_${uuid().slice(0, 8)}`;
        const createdAt = new Date(Date.now() - ev.hours_ago * 3600000).toISOString();
        await sql`
          INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body, read, created_at)
          VALUES (${id}, ${ev.user_id}, ${ev.type}, ${ev.thread_id}, ${ev.thread_title}, ${ev.message_id}, ${ev.actor_id}, ${ev.actor_name}, ${ev.body}, ${false}, ${createdAt})
          ON CONFLICT (id) DO NOTHING
        `;
      }

      return NextResponse.json({
        success: true,
        summary: {
          humans: HUMANS.map(h => ({ name: h.name, email: h.email })),
          agents: AGENTS_DATA.map(a => a.name),
          channels: channels.map(c => c.name),
          threads: L.summaryThreads,
          login: "Use any email above with password: password123",
        },
      });
    } catch (error) {
      console.error("Seed error:", error);
      return NextResponse.json({ error: "Seed failed", details: String(error) }, { status: 500 });
    }
  });
}

// ── Helper: Create thread with messages, tasks, and links ──

function createThreadWithMessages(
  meta: ThreadMeta,
  messages: { from: Participant; body: string; hoursAgo: number }[],
  tasks: { description: string; assignee?: Participant; status: ActionItem["status"]; created_by: Participant }[],
  links: { url: string; title: string; type: "demo" | "reference" | "external" }[],
) {
  try {
    createThread(meta);
  } catch {
    return; // Thread may already exist
  }

  // Add messages
  for (const msg of messages) {
    const message: Message = {
      id: `msg_${meta.id}_${uuid().slice(0, 8)}`,
      ts: tsHoursAgo(msg.hoursAgo),
      from: msg.from.id,
      from_name: msg.from.name,
      type: "text",
      body: msg.body,
    };
    addMessage(meta.id, message);
  }

  // Add tasks
  const now = new Date().toISOString();
  for (const task of tasks) {
    const actionItem: ActionItem = {
      id: `task_${uuid().slice(0, 8)}`,
      description: task.description,
      assignee: task.assignee?.id,
      assignee_name: task.assignee?.name,
      status: task.status,
      created_by: task.created_by.id,
      created_by_name: task.created_by.name,
      created_at: now,
      updated_at: now,
    };
    addThreadTask(meta.id, actionItem);
  }

  // Add links
  for (const link of links) {
    addLink(meta.id, {
      id: `link_${uuid().slice(0, 8)}`,
      url: link.url,
      title: link.title,
      type: link.type,
      added_by: meta.participants[0]?.name || "System",
      added_at: now,
    });
  }
}
