"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RegisterHumanForm } from "@/components/shared/RegisterHumanForm";
import { RegisterAgentForm } from "@/components/shared/RegisterAgentForm";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { CopyButton } from "@/components/shared/CopyButton";
import { getInitials, timeAgo, memberUrl } from "@/components/shared/helpers";
import type { User, RegisteredAgent } from "@/components/shared/types";

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
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Tips
- Use \`muleteam --as ${name}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes
\`\`\``;
}

export default function MembersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // Register human
  const [registerHumanOpen, setRegisterHumanOpen] = useState(false);
  const [registerHumanResult, setRegisterHumanResult] = useState<{ name: string; email: string; password: string } | null>(null);

  // Register agent
  const [registerAgentOpen, setRegisterAgentOpen] = useState(false);
  const [registerAgentResult, setRegisterAgentResult] = useState<{ name: string; token: string; description: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const [usersRes, agentsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/agents"),
      ]);
      if (usersRes.ok) setAllUsers((await usersRes.json()).users ?? []);
      if (agentsRes.ok) setAgents((await agentsRes.json()).agents ?? []);
      setLoading(false);
    }
    load();
  }, [authLoading]);

  const fetchAgents = async () => {
    const res = await fetch("/api/agents");
    if (res.ok) setAgents((await res.json()).agents ?? []);
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) setAllUsers((await res.json()).users ?? []);
  };

  const handleDeleteAgent = async (agentId: string, agentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete agent @${agentName}? This cannot be undone.`)) return;
    const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (res.ok) setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  const handleDeleteHuman = async (userId: string, userName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete user ${userName}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) setAllUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Members ({allUsers.length + agents.length})
        </h1>
        <div className="flex items-center gap-2">
          {/* Register Human */}
          <Dialog open={registerHumanOpen} onOpenChange={(open) => {
            setRegisterHumanOpen(open);
            if (!open) setRegisterHumanResult(null);
          }}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              + Register Human
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Register Human</DialogTitle>
              </DialogHeader>
              {registerHumanResult ? (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    User <span className="font-medium text-foreground">{registerHumanResult.name}</span> registered. Share these credentials — the password won&apos;t be shown again.
                  </p>
                  <div className="rounded-md bg-muted p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Name</span>
                      <code className="text-xs font-mono">{registerHumanResult.name}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <code className="text-xs font-mono">{registerHumanResult.email}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Password</span>
                      <code className="text-xs font-mono">{registerHumanResult.password}</code>
                    </div>
                  </div>
                  <CopyButton
                    className="w-full"
                    variant="outline"
                    size="default"
                    label="Copy to clipboard"
                    text={`Name: ${registerHumanResult.name}\nEmail: ${registerHumanResult.email}\nPassword: ${registerHumanResult.password}`}
                  />
                  <Button className="w-full" onClick={() => {
                    setRegisterHumanOpen(false);
                    setRegisterHumanResult(null);
                  }}>
                    Done
                  </Button>
                </div>
              ) : (
                <RegisterHumanForm
                  onSuccess={(name, email, password) => {
                    setRegisterHumanResult({ name, email, password });
                    fetchUsers();
                  }}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Register Agent */}
          <Dialog open={registerAgentOpen} onOpenChange={(open) => {
            setRegisterAgentOpen(open);
            if (!open) setRegisterAgentResult(null);
          }}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              + Register Agent
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
              <DialogHeader className="shrink-0">
                <DialogTitle>Register Agent</DialogTitle>
              </DialogHeader>
              {registerAgentResult ? (
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4 pt-2 pb-2">
                    <p className="text-sm text-muted-foreground">
                      Agent <span className="font-medium text-foreground">@{registerAgentResult.name}</span> registered.
                    </p>
                    <div className="rounded-md border border-border p-3 space-y-2">
                      <p className="text-xs font-medium">Paste into Claude Code to set up:</p>
                      <div className="rounded bg-muted p-2 max-h-48 overflow-y-auto">
                        <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">
                          {setupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)}
                        </pre>
                      </div>
                      <CopyButton
                        className="w-full"
                        label="Copy setup prompt"
                        text={setupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)}
                      />
                    </div>
                    <div className="rounded bg-muted/50 border border-border p-2">
                      <p className="text-[11px] text-muted-foreground">
                        Token: <code className="font-mono text-foreground break-all">{registerAgentResult.token}</code>
                      </p>
                    </div>
                    <Button className="w-full" onClick={() => {
                      setRegisterAgentOpen(false);
                      setRegisterAgentResult(null);
                      fetchAgents();
                    }}>
                      Done
                    </Button>
                  </div>
                </ScrollArea>
              ) : (
                <RegisterAgentForm
                  onSuccess={(name, token, description) => {
                    setRegisterAgentResult({ name, token, description });
                    fetchAgents();
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Members list */}
      <div className="divide-y divide-border rounded-md border border-border">
        {/* Humans */}
        {allUsers.map((u) => {
          const isCurrentUser = u.id === user?.id;
          return (
            <div
              key={`human:${u.id}`}
              className="group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(memberUrl(`human:${u.id}`))}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-xs font-medium shrink-0">
                {getInitials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{u.name}</span>
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                  <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    Human
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{u.description || u.email}</p>
              </div>
              {!isCurrentUser && (
                <button
                  onClick={(e) => handleDeleteHuman(u.id, u.name, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive shrink-0"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              )}
            </div>
          );
        })}

        {/* Agents */}
        {agents.map((agent) => (
          <div
            key={`agent:${agent.id}`}
            className="group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push(memberUrl(`agent:${agent.id}`))}
          >
            <AgentAvatar name={agent.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">@{agent.name}</span>
                <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  Agent
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {agent.description && (
                  <span className="text-xs text-muted-foreground">{agent.description}</span>
                )}
                {agent.description && <span className="text-xs text-muted-foreground">&middot;</span>}
                <span className="text-xs text-muted-foreground">seen {timeAgo(agent.last_seen_at)}</span>
              </div>
            </div>
            <button
              onClick={(e) => handleDeleteAgent(agent.id, agent.name, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive shrink-0"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ))}

        {allUsers.length === 0 && agents.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No members yet. Register humans or agents to get started.</p>
          </div>
        )}
      </div>
    </main>
  );
}
