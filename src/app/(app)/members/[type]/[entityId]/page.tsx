"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { useNavigation } from "@/components/layout/NavigationContext";
import { CHANNEL_CONFIG, ICON_STROKE } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setupPrompt, openCodeSetupPrompt, openClawSetupPrompt, claudeMdSnippet, openCodeSnippet, openClawSkillSnippet } from "@/components/shared/setupPrompt";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { useT } from "@/lib/i18n";
import { timeAgo, memberUrl } from "@/components/shared/helpers";
import { Input } from "@/components/ui/input";
import {
  TitleBar,
  TitleBarHeading,
  TitleBarTitle,
  TitleBarBack,
} from "@/components/patterns/titlebar";
import type { User, RegisteredAgent, ThreadMeta, ChannelMeta } from "@/components/shared/types";

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { setChannel: navSetChannel } = useNavigation();

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
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDraft, setWebhookDraft] = useState("");
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pats, setPats] = useState<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>([]);
  const [patGenerating, setPatGenerating] = useState(false);
  const [newPatToken, setNewPatToken] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
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
        // Fetch webhook URL and PATs for own profile
        if (currentUser?.id === entityId) {
          const [webhookRes, patsRes] = await Promise.all([
            fetch("/api/auth/me/webhook"),
            fetch("/api/auth/me/tokens"),
          ]);
          if (webhookRes.ok) {
            const data = await webhookRes.json();
            const url = data.webhook_url ?? "";
            setWebhookUrl(url);
            setWebhookDraft(url);
          }
          if (patsRes.ok) {
            const data = await patsRes.json();
            setPats(data.tokens ?? []);
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
      <main className="h-full flex flex-col">
        {/* TitleBar with breadcrumb */}
        <TitleBar className="backdrop-blur-[24px]" style={{ backgroundColor: "color-mix(in srgb, var(--bg-grouped-tertiary) 85%, transparent)" }}>
          <TitleBarBack onClick={() => router.push("/members")}>Members</TitleBarBack>
        </TitleBar>

        <div className="flex-1 overflow-y-auto scrollbar-thin -mt-16 pt-16">
          <div className="mx-auto max-w-[848px] w-full px-6 pb-16">
            {/* Centered profile header */}
            <div className="flex flex-col items-center text-center pt-24 pb-16">
              <MemberAvatar type="agent" name={memberAgent.name} size={96} />
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-[length:var(--font-size-subtitle)] font-bold leading-[1.5] text-[var(--label-primary)]">@{memberAgent.name}</h1>
                <span className="bg-[var(--color-orange-100)] text-[var(--color-orange-1000)] text-xs px-3 h-6 inline-flex items-center rounded-full">Agent</span>
              </div>
              {memberAgent.description && (
                <p className="text-[length:var(--font-size-body-small)] text-[var(--label-secondary)] mt-3 max-w-[480px]">{memberAgent.description}</p>
              )}
              {memberAgent.capabilities && memberAgent.capabilities.length > 0 && (
                <div className="flex items-center gap-1 mt-3 flex-wrap justify-center">
                  {memberAgent.capabilities.map((tag) => (
                    <span key={tag} className="bg-[var(--fill-quaternary)] text-[var(--label-primary)] text-xs px-2 h-5 inline-flex items-center rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>

        <div className="grid grid-cols-2 gap-4 mb-16">
          <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-3">
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm">{memberAgent.created_at ? new Date(memberAgent.created_at).toLocaleDateString() : "—"}</p>
          </div>
          <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-3">
            <p className="text-xs text-muted-foreground mb-1">Last Seen</p>
            <p className="text-sm">{timeAgo(memberAgent.last_seen_at)}</p>
          </div>
          {memberAgent.created_by && (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-3 col-span-2">
              <p className="text-xs text-muted-foreground mb-1">{t("members.hiredBy")}</p>
              <p className="text-sm">
                <Link href={memberUrl(`human:${memberAgent.created_by.id}`)} className="hover:underline">
                  {memberAgent.created_by.name}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Setup Instructions (always visible) */}
        <div className="mb-14">
          <div className="flex items-center justify-between h-8 pl-1">
            <h2 className="text-[length:var(--font-size-subheading)] font-semibold">{t("agent.setupGuide")}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-5 pl-1">{t("agent.setupGuideDesc")}</p>
          <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">

          {/* CLI Install command */}
          <details className="mb-4">
            <summary className="text-xs font-medium cursor-pointer hover:text-foreground">
              {t("agent.cliInstall")}
            </summary>
            <div className="rounded bg-[var(--fill-quaternary)] p-3 mt-2">
              <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">{`mkdir -p ~/.local/bin && curl -sL ${typeof window !== "undefined" ? window.location.origin : ""}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${typeof window !== "undefined" ? window.location.origin : ""} MULETEAM_TOKEN=<your-token> muleteam setup ${memberAgent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}</pre>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{t("agent.cliInstallNote")}</p>
          </details>
          <Tabs value={snippetTab} onValueChange={(v) => setSnippetTab(v as "claude" | "opencode" | "openclaw")} className="mb-3">
            <TabsList variant="segmented" size="sm">
              <TabsTrigger value="claude">{t("members.tabClaudeCode")}</TabsTrigger>
              <TabsTrigger value="opencode">{t("members.tabOpenCode")}</TabsTrigger>
              <TabsTrigger value="openclaw">{t("members.tabOpenClaw")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs font-medium mb-2">
            {snippetTab === "claude"
              ? "CLAUDE.md"
              : snippetTab === "opencode"
              ? "AGENTS.md"
              : "SKILL.md"}
          </p>
          <div className="rounded bg-[var(--fill-quaternary)] p-3">
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
        </div>

        {/* Token Management */}
        <div className="mb-14">
          <div className="flex items-center justify-between h-8 pl-1">
            <h2 className="text-[length:var(--font-size-subheading)] font-semibold">{t("agent.tokenManagement")}</h2>
            {!newToken && (
              <>
                <Button variant="outline-filled" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={regenerating}>
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
          <p className="text-xs text-muted-foreground mt-1 mb-5 pl-1">
            {newToken ? t("agent.newTokenGenerated") : t("agent.tokenDesc")}
          </p>
          <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">
          {(() => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const tokenValue = newToken || "<your-token>";
            const setupTexts = {
              claude: setupPrompt(origin, memberAgent.name, tokenValue, memberAgent.description),
              opencode: openCodeSetupPrompt(origin, memberAgent.name, tokenValue, memberAgent.description),
              openclaw: openClawSetupPrompt(origin, memberAgent.name, tokenValue, memberAgent.description),
            };
            return (
              <div className="space-y-3">
                {newToken && (
                  <div className="rounded bg-muted/50 border border-[var(--border-color-secondary)] p-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("members.token")}: <code className="font-mono text-foreground break-all">{newToken}</code>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Tabs value={setupTab} onValueChange={(v) => setSetupTab(v as "claude" | "opencode" | "openclaw")} className="mb-2">
                    <TabsList variant="segmented" size="sm">
                      <TabsTrigger value="claude">{t("members.tabClaudeCode")}</TabsTrigger>
                      <TabsTrigger value="opencode">{t("members.tabOpenCode")}</TabsTrigger>
                      <TabsTrigger value="openclaw">{t("members.tabOpenClaw")}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs font-medium">
                    {setupTab === "claude" ? t("members.pasteSetupPrompt") : setupTab === "opencode" ? t("members.pasteOpenCode") : t("members.pasteOpenClaw")}
                  </p>
                  <div className="rounded bg-[var(--fill-quaternary)] p-2 max-h-48 overflow-y-auto">
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
        </div>

        {/* Channels */}
        <div className="mb-14">
          <div className="flex items-center justify-between h-8 pl-1 mb-5"><h2 className="text-[length:var(--font-size-subheading)] font-semibold">Channels ({memberChannels.length})</h2></div>
          {memberChannels.length === 0 ? (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">
              <p className="text-sm text-[var(--label-tertiary)] text-center">Not in any channels yet.</p>
            </div>
          ) : (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-1 member-list-container">
              {memberChannels.map((p) => {
                const chConfig = CHANNEL_CONFIG[p.id];
                const ChIcon = chConfig?.icon;
                return (
                <div key={p.id} className="member-list-row relative flex items-center justify-between rounded-[8px] px-3 h-11 text-sm hover:bg-[var(--fill-quaternary)] cursor-pointer transition-colors" onClick={() => navSetChannel(p.id)}>
                  <div className="flex items-center gap-2">
                    {ChIcon && <ChIcon className={`size-4 shrink-0 ${chConfig.color}`} strokeWidth={ICON_STROKE} />}
                    <span>{p.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{p.members.length} members</span>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Threads */}
        <div>
          <div className="flex items-center justify-between h-8 pl-1 mb-5"><h2 className="text-[length:var(--font-size-subheading)] font-semibold">Threads ({memberThreads.length})</h2></div>
          {memberThreads.length === 0 ? (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">
              <p className="text-sm text-[var(--label-tertiary)] text-center">Not participating in any threads yet.</p>
            </div>
          ) : (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-1 member-list-container">
              {memberThreads.map((t) => (
                <div
                  key={t.id}
                  className="member-list-row relative flex items-center gap-3 px-3 h-11 rounded-[8px] cursor-pointer hover:bg-[var(--fill-quaternary)] transition-colors"
                  onClick={() => router.push(`/thread/${t.id}`)}
                >
                  <span className="text-sm flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
        </div>
      </main>
    );
  }

  if (!isAgent && memberUser) {
    return (
      <main className="h-full flex flex-col">
        {/* TitleBar with breadcrumb */}
        <TitleBar className="backdrop-blur-[24px]" style={{ backgroundColor: "color-mix(in srgb, var(--bg-grouped-tertiary) 85%, transparent)" }}>
          <TitleBarBack onClick={() => router.push("/members")}>Members</TitleBarBack>
        </TitleBar>

        <div className="flex-1 overflow-y-auto scrollbar-thin -mt-16 pt-16">
          <div className="mx-auto max-w-[848px] w-full px-6 pb-16">
            {/* Centered profile header */}
            <div className="flex flex-col items-center text-center pt-24 pb-16">
              <MemberAvatar type="human" name={memberUser.name} size={96} avatarUrl={memberUser.avatar_url} />
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-[length:var(--font-size-subtitle)] font-bold leading-[1.5] text-[var(--label-primary)]">{memberUser.name}</h1>
                <span className="bg-[var(--color-green-100)] text-[var(--color-green-1000)] text-xs px-3 h-6 inline-flex items-center rounded-full">Human</span>
              </div>
              {memberUser.description && (
                <p className="text-[length:var(--font-size-body-small)] text-[var(--label-secondary)] mt-3 max-w-[480px]">{memberUser.description}</p>
              )}
            </div>


        <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4 mb-16">
          {memberUser.created_at && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--label-primary)]">Joined</span>
              <span className="text-sm text-[var(--label-secondary)]">{new Date(memberUser.created_at).toLocaleDateString()}</span>
            </div>
          )}
          {memberUser.invited_by && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--label-primary)]">Invited by</span>
              <Link href={memberUrl(`human:${memberUser.invited_by.id}`)} className="text-sm text-[var(--label-secondary)] hover:underline">
                {memberUser.invited_by.name}
              </Link>
            </div>
          )}
        </div>

        {/* Webhook Notifications — own profile only */}
        {isOwnProfile && (
          <div className="mb-14">
            <div className="flex items-center justify-between h-8 pl-1">
              <h2 className="text-[length:var(--font-size-subheading)] font-semibold">{t("webhook.title")}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 mb-5 pl-1">{t("webhook.help")}</p>
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">
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
              <p className={`text-xs mt-2 ${webhookMsg.type === "success" ? "text-[var(--color-green-1000)]" : "text-destructive"}`}>
                {webhookMsg.text}
              </p>
            )}
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                {t("webhook.samplePayload")}
              </summary>
              <div className="rounded bg-[var(--fill-quaternary)] p-3 mt-2">
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
          </div>
        )}

        {/* Personal Access Tokens — own profile only */}
        {isOwnProfile && (
          <div className="mb-14">
            <div className="flex items-center justify-between h-8 pl-1">
              <h2 className="text-[length:var(--font-size-subheading)] font-semibold">{t("pat.title")}</h2>
              <Button
                variant="outline-filled"
                size="sm"
                disabled={patGenerating}
                onClick={async () => {
                  setPatGenerating(true);
                  setNewPatToken(null);
                  try {
                    const res = await fetch("/api/auth/me/tokens", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: "default" }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setNewPatToken(data.token);
                      // Refresh list
                      const listRes = await fetch("/api/auth/me/tokens");
                      if (listRes.ok) {
                        const listData = await listRes.json();
                        setPats(listData.tokens ?? []);
                      }
                    }
                  } finally {
                    setPatGenerating(false);
                  }
                }}
              >
              {patGenerating ? "..." : t("pat.generate")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 mb-5 pl-1">{t("pat.description")}</p>
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">

            {newPatToken && (
              <div className="rounded-md bg-[var(--bg-grouped-quaternary)] bg-muted/50 p-3 mb-3 space-y-2">
                <p className="text-xs text-[var(--color-green-1000)] font-medium">{t("pat.generated")}</p>
                <div className="rounded bg-[var(--fill-quaternary)] p-2">
                  <code className="text-[11px] font-mono break-all text-foreground">{newPatToken}</code>
                </div>
                <CopyButton className="w-full" label={t("common.copy")} text={newPatToken} />
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    {t("pat.cliUsage")}
                  </summary>
                  <div className="rounded bg-[var(--fill-quaternary)] p-2 mt-1">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">{`MULETEAM_TOKEN=${newPatToken} muleteam setup ${currentUser?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ?? "your-name"}`}</pre>
                  </div>
                </details>
              </div>
            )}

            {pats.length === 0 ? (
              <p className="text-sm text-[var(--label-tertiary)] text-center">{t("pat.noTokens")}</p>
            ) : (
              <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-1 member-list-container">
                {pats.map((pat) => (
                  <div key={pat.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pat.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {pat.last_used_at
                          ? t("pat.lastUsed").replace("{time}", timeAgo(pat.last_used_at))
                          : t("pat.neverUsed")}
                        {" · "}
                        {new Date(pat.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive text-xs"
                      onClick={() => setConfirmRevokeId(pat.id)}
                    >
                      {t("pat.revoke")}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <ConfirmDialog
              open={confirmRevokeId !== null}
              onOpenChange={(open) => { if (!open) setConfirmRevokeId(null); }}
              title={t("pat.confirmRevoke")}
              variant="destructive"
              onConfirm={async () => {
                if (!confirmRevokeId) return;
                const idToRevoke = confirmRevokeId;
                setConfirmRevokeId(null);
                await fetch(`/api/auth/me/tokens?id=${idToRevoke}`, { method: "DELETE" });
                setPats((prev) => prev.filter((p) => p.id !== idToRevoke));
              }}
            />
            </div>
          </div>
        )}

        {/* Channels */}
        <div className="mb-14">
          <div className="flex items-center justify-between h-8 pl-1 mb-5"><h2 className="text-[length:var(--font-size-subheading)] font-semibold">Channels ({memberChannels.length})</h2></div>
          {memberChannels.length === 0 ? (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">
              <p className="text-sm text-[var(--label-tertiary)] text-center">Not in any channels yet.</p>
            </div>
          ) : (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-1 member-list-container">
              {memberChannels.map((p) => {
                const chConfig = CHANNEL_CONFIG[p.id];
                const ChIcon = chConfig?.icon;
                return (
                <div key={p.id} className="member-list-row relative flex items-center justify-between rounded-[8px] px-3 h-11 text-sm hover:bg-[var(--fill-quaternary)] cursor-pointer transition-colors" onClick={() => navSetChannel(p.id)}>
                  <div className="flex items-center gap-2">
                    {ChIcon && <ChIcon className={`size-4 shrink-0 ${chConfig.color}`} strokeWidth={ICON_STROKE} />}
                    <span>{p.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{p.members.length} members</span>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Threads */}
        <div>
          <div className="flex items-center justify-between h-8 pl-1 mb-5"><h2 className="text-[length:var(--font-size-subheading)] font-semibold">Threads ({memberThreads.length})</h2></div>
          {memberThreads.length === 0 ? (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-4">
              <p className="text-sm text-[var(--label-tertiary)] text-center">Not participating in any threads yet.</p>
            </div>
          ) : (
            <div className="rounded-md bg-[var(--bg-grouped-quaternary)] p-1 member-list-container">
              {memberThreads.map((t) => (
                <div
                  key={t.id}
                  className="member-list-row relative flex items-center gap-3 px-3 h-11 rounded-[8px] cursor-pointer hover:bg-[var(--fill-quaternary)] transition-colors"
                  onClick={() => router.push(`/thread/${t.id}`)}
                >
                  <span className="text-sm flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[800px] px-6 py-10">
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
