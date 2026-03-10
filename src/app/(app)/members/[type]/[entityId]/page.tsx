"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { CopyButton } from "@/components/shared/CopyButton";
import { getInitials, timeAgo, memberUrl } from "@/components/shared/helpers";
import type { User, RegisteredAgent, ThreadMeta, ChannelMeta } from "@/components/shared/types";

function setupPrompt(origin: string, name: string, token: string, description: string) {
  return `Set up MuleTeam agent "@${name}". Do these two steps:

1. Run this command to install the CLI and save credentials:
\`\`\`bash
mkdir -p ~/.local/bin && curl -sL ${origin}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${origin} MULETEAM_TOKEN=${token} muleteam setup ${name}
\`\`\`

2. Add the following MuleTeam section to the project's CLAUDE.md. If CLAUDE.md already exists, merge it naturally into the existing content (don't duplicate headers or overwrite other instructions). If it doesn't exist, create it.
\`\`\`
# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` — ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Post updates as you make progress with \`muleteam post <id> "message"\`
- Check thread history with \`muleteam history <id>\`

## Tips
- Use \`muleteam --as ${name}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes
\`\`\``;
}

function claudeMdSnippet(name: string, description: string) {
  return `# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` \u2014 ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Post updates as you make progress with \`muleteam post <id> "message"\`
- Check thread history with \`muleteam history <id>\`

## Tips
- Use \`muleteam --as ${name}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes`;
}

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
      }
      setLoading(false);
    }
    load();
  }, [authLoading, isAgent, entityId]);

  const handleRegenerateToken = async () => {
    if (!memberAgent) return;
    if (!confirm(`Regenerate token for @${memberAgent.name}? The current token will be invalidated immediately.`)) return;
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
          <AgentAvatar name={memberAgent.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold">@{memberAgent.name}</h1>
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

        {/* Token management + Setup */}
        <div className="rounded-md border border-border p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">API Token</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {newToken ? "New token generated. Copy the setup prompt below." : "Regenerate if the token was lost or compromised."}
              </p>
            </div>
            {!newToken && (
              <Button variant="outline" size="sm" onClick={handleRegenerateToken} disabled={regenerating}>
                {regenerating ? "Regenerating..." : "Regenerate Token"}
              </Button>
            )}
          </div>
          {newToken && (() => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            return (
              <div className="mt-3 space-y-3">
                <div className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-xs font-medium">Paste into Claude Code to set up:</p>
                  <div className="rounded bg-muted p-2 max-h-48 overflow-y-auto">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">
                      {setupPrompt(origin, memberAgent.name, newToken, memberAgent.description)}
                    </pre>
                  </div>
                  <CopyButton
                    className="w-full"
                    label="Copy setup prompt"
                    text={setupPrompt(origin, memberAgent.name, newToken, memberAgent.description)}
                  />
                </div>
                <div className="rounded bg-muted/50 border border-border p-2">
                  <p className="text-[11px] text-muted-foreground">
                    Token: <code className="font-mono text-foreground break-all">{newToken}</code>
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* CLAUDE.md snippet (always visible) */}
        <div className="rounded-md border border-border p-4 mb-8">
          <p className="text-sm font-medium mb-2">CLAUDE.md Snippet</p>
          <div className="rounded bg-muted p-3">
            <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
              {claudeMdSnippet(memberAgent.name, memberAgent.description)}
            </pre>
          </div>
          <CopyButton
            className="w-full mt-2"
            label="Copy CLAUDE.md snippet"
            text={claudeMdSnippet(memberAgent.name, memberAgent.description)}
          />
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
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background text-lg font-medium">
            {getInitials(memberUser.name)}
          </span>
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
