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
import { setupPrompt } from "@/components/shared/setupPrompt";
import { getInitials, timeAgo, memberUrl } from "@/components/shared/helpers";
import { useT } from "@/lib/i18n";
import type { User, RegisteredAgent } from "@/components/shared/types";

export default function MembersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useT();
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
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("members.title")} ({allUsers.length + agents.length})
        </h1>
        <div className="flex items-center gap-2">
          {/* Register Human */}
          <Dialog open={registerHumanOpen} onOpenChange={(open) => {
            setRegisterHumanOpen(open);
            if (!open) setRegisterHumanResult(null);
          }}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <span className="hidden sm:inline">{t("members.registerHuman")}</span>
              <span className="sm:hidden">+ Human</span>
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
                      <span className="text-xs text-muted-foreground">{t("auth.email")}</span>
                      <code className="text-xs font-mono">{registerHumanResult.email}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t("auth.password")}</span>
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
                    {t("common.done")}
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
              <span className="hidden sm:inline">{t("members.registerAgent")}</span>
              <span className="sm:hidden">+ Agent</span>
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
                      {t("common.done")}
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

      {/* Members list — use min-h-0 and overflow-y-auto to prevent clipping on mobile */}
      <div className="divide-y divide-border rounded-md border border-border overflow-y-auto">
        {/* Humans */}
        {allUsers.map((u) => {
          const isCurrentUser = u.id === user?.id;
          return (
            <div
              key={`human:${u.id}`}
              className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(memberUrl(`human:${u.id}`))}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-xs font-medium shrink-0">
                {getInitials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{u.name}</span>
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">{t("members.you")}</span>
                  )}
                  <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    {t("members.human")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.description || u.email}</p>
              </div>
              {!isCurrentUser && (
                <button
                  onClick={(e) => handleDeleteHuman(u.id, u.name, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive shrink-0"
                  title={t("common.delete")}
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
            className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => router.push(memberUrl(`agent:${agent.id}`))}
          >
            <AgentAvatar name={agent.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">@{agent.name}</span>
                <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  {t("members.agent")}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {agent.description && (
                  <span className="text-xs text-muted-foreground truncate">{agent.description}</span>
                )}
                {agent.description && <span className="text-xs text-muted-foreground">&middot;</span>}
                <span className="text-xs text-muted-foreground shrink-0">seen {timeAgo(agent.last_seen_at)}</span>
              </div>
            </div>
            <button
              onClick={(e) => handleDeleteAgent(agent.id, agent.name, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive shrink-0"
              title={t("common.delete")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ))}

        {allUsers.length === 0 && agents.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("members.noMembers")}</p>
          </div>
        )}
      </div>
    </main>
  );
}
