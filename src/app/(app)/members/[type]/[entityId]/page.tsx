"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { setupPrompt, openCodeSetupPrompt, openClawSetupPrompt, claudeMdSnippet, openCodeSnippet, openClawSkillSnippet } from "@/components/shared/setupPrompt";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { useT } from "@/lib/i18n";
import { timeAgo, memberUrl } from "@/components/shared/helpers";
import { Input } from "@/components/ui/input";
import type { User, RegisteredAgent, ThreadMeta, ChannelMeta } from "@/components/shared/types";

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

  const memberType = params.type as string;
  const entityId = params.entityId as string;
  const isAgent = memberType === "agent";
  const rawId = `${memberType}:${entityId}`;
  const isOwnProfile = !isAgent && currentUser?.id === entityId;

  const [memberUser, setMemberUser] = useState<User | null>(null);
  const [memberAgent, setMemberAgent] = useState<RegisteredAgent | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [setupTab, setSetupTab] = useState<"claude" | "opencode" | "openclaw">("claude");
  const [snippetTab, setSnippetTab] = useState<"claude" | "opencode" | "openclaw">("claude");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDraft, setWebhookDraft] = useState("");
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const t = useT();

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const [threadsRes, channelsRes] = await Promise.all([
        fetch("/api/threads"),
        fetch("/api/channels"),
      ]);
      if (threadsRes.ok) setThreads((await threadsRes.json()).threads ?? []);
      if (channelsRes.ok) setChannels((await channelsRes.json()).channels ?? []);

      if (isAgent) {
        const agentRes = await fetch(`/api/agents/${entityId}`);
        if (agentRes.ok) {
          const data = await agentRes.json();
          setMemberAgent(data.agent);
        }
      } else {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const data = await usersRes.json();
          const found = (data.users ?? []).find((u: User) => u.id === entityId);
          if (found) setMemberUser(found);
        }
        // Fetch webhook URL for own profile
        if (currentUser?.id === entityId) {
          const webhookRes = await fetch("/api/auth/me/webhook");
          if (webhookRes.ok) {
            const data = await webhookRes.json();
            const url = data.webhook_url ?? "";
            setWebhookUrl(url);
            setWebhookDraft(url);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [authLoading, isAgent, entityId]);

  const handleRegenerateToken = async () => {
    if (!memberAgent) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/agents/${memberAgent.id}/regenerate-token`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
      }
    } finally {
      setRegenerating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Member's threads and channels
  const memberThreads = threads
    .filter((t) => t.participants.some((p) => p.id === rawId))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const memberChannels = channels.filter((p) => p.members.some((m) => m.id === rawId));

  if (isAgent && memberAgent) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <button
          className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
          onClick={() => router.push("/members")}
        >
          &larr; Members
        </button>

        <div className="flex items-center gap-4 mb-8">
          <MemberAvatar type="agent" name={memberAgent.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold">@{memberAgent.name}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {memberAgent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
            </p>
            {memberAgent.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{memberAgent.description}</p>
            )}
          </div>
          <span className="inline-flex h-6 items-center rounded bg-muted px-2 text-xs font-medium text-muted-foreground ml-auto">
            Agent
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm">{memberAgent.created_at ? new Date(memberAgent.created_at).toLocaleDateString() : "—"}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground mb-1">Last Seen</p>
            <p className="text-sm">{timeAgo(memberAgent.last_seen_at)}</p>
          </div>
          {memberAgent.created_by && (
            <div className="rounded-md border border-border p-3 col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Created by</p>
              <p className="text-sm">
                <Link href={memberUrl(`human:${memberAgent.created_by.id}`)} className="hover:underline">
                  {memberAgent.created_by.name}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Setup Instructions (always visible) */}
        <div className="rounded-md border border-border p-4 mb-8">
          <h2 className="text-sm font-semibold mb-1">{t("agent.setupGuide")}</h2>
          <p className="text-xs text-muted-foreground mb-3">{t("agent.setupGuideDesc")}</p>

          {/* CLI Install command */}
          <details className="mb-4">
            <summary className="text-xs font-medium cursor-pointer hover:text-foreground">
              {t("agent.cliInstall")}
            </summary>
            <div className="rounded bg-muted p-3 mt-2">
              <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">{`mkdir -p ~/.local/bin && curl -sL ${typeof window !== "undefined" ? window.location.origin : ""}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${typeof window !== "undefined" ? window.location.origin : ""} MULETEAM_TOKEN=<your-token> muleteam setup ${memberAgent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}</pre>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{t("agent.cliInstallNote")}</p>
          </details>
          <div className="flex gap-1 mb-3">
            {(["claude", "opencode", "openclaw"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSnippetTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  snippetTab === tab
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "claude" ? t("members.tabClaudeCode") : tab === "opencode" ? t("members.tabOpenCode") : t("members.tabOpenClaw")}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium mb-2">
            {snippetTab === "claude"
              ? "CLAUDE.md"
              : snippetTab === "opencode"
              ? "AGENTS.md"
              : "SKILL.md"}
          </p>
          <div className="rounded bg-muted p-3">
            <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
              {snippetTab === "claude"
                ? claudeMdSnippet(memberAgent.name, memberAgent.description)
                : snippetTab === "opencode"
                ? openCodeSnippet(memberAgent.name, memberAgent.description)
                : openClawSkillSnippet(memberAgent.name, memberAgent.description)}
            </pre>
          </div>
          <CopyButton
            className="w-full mt-2"
            label={snippetTab === "claude" ? "Copy CLAUDE.md snippet" : snippetTab === "opencode" ? "Copy AGENTS.md snippet" : "Copy SKILL.md snippet"}
            text={
              snippetTab === "claude"
                ? claudeMdSnippet(memberAgent.name, memberAgent.description)
                : snippetTab === "opencode"
                ? openCodeSnippet(memberAgent.name, memberAgent.description)
                : openClawSkillSnippet(memberAgent.name, memberAgent.description)
            }
          />
        </div>

        {/* Token Management */}
        <div className="rounded-md border border-border p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t("agent.tokenManagement")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {newToken ? t("agent.newTokenGenerated") : t("agent.tokenDesc")}
              </p>
            </div>
            {!newToken && (
              <>
                <Button variant="outline" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={regenerating}>
                  {regenerating ? "..." : t("agent.regenerateToken")}
                </Button>
                <ConfirmDialog
                  open={confirmRegenerate}
                  onOpenChange={setConfirmRegenerate}
                  title={t("members.confirmRegenerateToken").replace("{name}", memberAgent.name)}
                  variant="destructive"
                  onConfirm={async () => {
                    setConfirmRegenerate(false);
                    await handleRegenerateToken();
                  }}
                />
              </>
            )}
          </div>
          {(() => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const tokenValue = newToken || "<your-token>";
            const setupTexts = {
              claude: setupPrompt(origin, memberAgent.name, tokenValue, memberAgent.description),
              opencode: openCodeSetupPrompt(origin, memberAgent.name, tokenValue, memberAgent.description),
              openclaw: openClawSetupPrompt(origin, memberAgent.name, tokenValue, memberAgent.description),
            };
            return (
              <div className="mt-3 space-y-3">
                {newToken && (
                  <div className="rounded bg-muted/50 border border-border p-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("members.token")}: <code className="font-mono text-foreground break-all">{newToken}</code>
                    </p>
                  </div>
                )}
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex gap-1 mb-2">
                    {(["claude", "opencode", "openclaw"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSetupTab(tab)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          setupTab === tab
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab === "claude" ? t("members.tabClaudeCode") : tab === "opencode" ? t("members.tabOpenCode") : t("members.tabOpenClaw")}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-medium">
                    {setupTab === "claude" ? t("members.pasteSetupPrompt") : setupTab === "opencode" ? t("members.pasteOpenCode") : t("members.pasteOpenClaw")}
                  </p>
                  <div className="rounded bg-muted p-2 max-h-48 overflow-y-auto">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">
                      {setupTexts[setupTab]}
                    </pre>
                  </div>
                  <CopyButton
                    className="w-full"
                    label={t("members.copySetupPrompt")}
                    text={setupTexts[setupTab]}
                  />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Channels */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Channels ({memberChannels.length})</h2>
          {memberChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not in any channels yet.</p>
          ) : (
            <div className="space-y-1">
              {memberChannels.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer" onClick={() => router.push("/channels")}>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.members.length} members</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Threads */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Threads ({memberThreads.length})</h2>
          {memberThreads.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not participating in any threads yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {memberThreads.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/thread/${t.id}`)}
                >
                  <span className="text-sm font-medium flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!isAgent && memberUser) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <button
          className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
          onClick={() => router.push("/members")}
        >
          &larr; Members
        </button>

        <div className="flex items-center gap-4 mb-8">
          <MemberAvatar type="human" name={memberUser.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold">{memberUser.name}</h1>
            {editingDescription ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground w-64"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Add a description..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingDescription(false);
                    if (e.key === "Enter") {
                      setSavingDescription(true);
                      fetch(`/api/users/${entityId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ description: descriptionDraft }),
                      }).then(() => {
                        setMemberUser({ ...memberUser, description: descriptionDraft || undefined });
                        setEditingDescription(false);
                      }).finally(() => setSavingDescription(false));
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingDescription}
                  onClick={() => {
                    setSavingDescription(true);
                    fetch(`/api/users/${entityId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ description: descriptionDraft }),
                    }).then(() => {
                      setMemberUser({ ...memberUser, description: descriptionDraft || undefined });
                      setEditingDescription(false);
                    }).finally(() => setSavingDescription(false));
                  }}
                >
                  {savingDescription ? "Saving..." : "Save"}
                </Button>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setEditingDescription(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground">
                  {memberUser.description || (isOwnProfile ? "No description" : "")}
                </p>
                {isOwnProfile && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDescriptionDraft(memberUser.description || "");
                      setEditingDescription(true);
                    }}
                  >
                    {memberUser.description ? "Edit" : "Add"}
                  </button>
                )}
              </div>
            )}
            {isOwnProfile && (
              <p className="text-xs text-muted-foreground mt-0.5">{memberUser.email}</p>
            )}
          </div>
          <span className="inline-flex h-6 items-center rounded bg-muted px-2 text-xs font-medium text-muted-foreground ml-auto">
            Human
          </span>
        </div>

        <div className="flex gap-4 mb-8 flex-wrap">
          {memberUser.created_at && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Joined</p>
              <p className="text-sm">{new Date(memberUser.created_at).toLocaleDateString()}</p>
            </div>
          )}
          {memberUser.invited_by && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Invited by</p>
              <p className="text-sm">
                <Link href={memberUrl(`human:${memberUser.invited_by.id}`)} className="hover:underline">
                  {memberUser.invited_by.name}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Webhook Notifications — own profile only */}
        {isOwnProfile && (
          <div className="rounded-md border border-border p-4 mb-8">
            <h2 className="text-sm font-semibold mb-1">{t("webhook.title")}</h2>
            <p className="text-xs text-muted-foreground mb-3">{t("webhook.help")}</p>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder={t("webhook.urlPlaceholder")}
                value={webhookDraft}
                onChange={(e) => {
                  setWebhookDraft(e.target.value);
                  setWebhookMsg(null);
                }}
                className="flex-1 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={webhookLoading || webhookDraft === webhookUrl}
                onClick={async () => {
                  setWebhookLoading(true);
                  setWebhookMsg(null);
                  try {
                    const res = await fetch("/api/auth/me/webhook", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ webhook_url: webhookDraft }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      const saved = data.webhook_url ?? "";
                      setWebhookUrl(saved);
                      setWebhookDraft(saved);
                      setWebhookMsg({ type: "success", text: t("webhook.saved") });
                    } else {
                      const data = await res.json().catch(() => ({}));
                      setWebhookMsg({ type: "error", text: data.error || "Failed to save" });
                    }
                  } catch {
                    setWebhookMsg({ type: "error", text: "Failed to save" });
                  } finally {
                    setWebhookLoading(false);
                  }
                }}
              >
                {t("common.save")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={webhookLoading || !webhookUrl}
                onClick={async () => {
                  setWebhookLoading(true);
                  setWebhookMsg(null);
                  try {
                    const res = await fetch("/api/auth/me/webhook", { method: "POST" });
                    if (res.ok) {
                      setWebhookMsg({ type: "success", text: t("webhook.testSent") });
                    } else {
                      setWebhookMsg({ type: "error", text: t("webhook.testFailed") });
                    }
                  } catch {
                    setWebhookMsg({ type: "error", text: t("webhook.testFailed") });
                  } finally {
                    setWebhookLoading(false);
                  }
                }}
              >
                {t("webhook.test")}
              </Button>
            </div>
            {webhookMsg && (
              <p className={`text-xs mt-2 ${webhookMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                {webhookMsg.text}
              </p>
            )}
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                {t("webhook.samplePayload")}
              </summary>
              <div className="rounded bg-muted p-3 mt-2">
                <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">{`{
  "event": "mention",
  "thread_id": "abc123",
  "thread_title": "Landing page redesign",
  "actor": "Demo User",
  "summary": "Demo User mentioned you in \\"Landing page redesign\\"",
  "url": "${typeof window !== "undefined" ? window.location.origin : "https://team.example.com"}/thread/abc123",
  "timestamp": "${new Date().toISOString().split("T")[0]}T12:00:00.000Z"
}`}</pre>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {t("webhook.eventTypes")}
              </p>
            </details>
          </div>
        )}

        {/* Channels */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Channels ({memberChannels.length})</h2>
          {memberChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not in any channels yet.</p>
          ) : (
            <div className="space-y-1">
              {memberChannels.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer" onClick={() => router.push("/channels")}>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.members.length} members</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Threads */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Threads ({memberThreads.length})</h2>
          {memberThreads.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not participating in any threads yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {memberThreads.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/thread/${t.id}`)}
                >
                  <span className="text-sm font-medium flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <button
        className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
        onClick={() => router.push("/members")}
      >
        &larr; Members
      </button>
      <p className="text-sm text-muted-foreground">Member not found.</p>
    </main>
  );
}
