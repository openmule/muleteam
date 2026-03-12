"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { setupPrompt, openCodeSetupPrompt, openClawSetupPrompt } from "@/components/shared/setupPrompt";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { timeAgo, memberUrl } from "@/components/shared/helpers";
import { useT } from "@/lib/i18n";
import type { User, RegisteredAgent } from "@/components/shared/types";

interface Invite {
  token: string;
  created_by: string;
  creator_name: string | null;
  note: string | null;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  status: string;
  created_at: string;
}

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
  const [setupTab, setSetupTab] = useState<"claude" | "opencode" | "openclaw">("claude");
  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteHuman, setConfirmDeleteHuman] = useState<{ id: string; name: string } | null>(null);

  // Invite member
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; expires_at: string } | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesExpanded, setInvitesExpanded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const [usersRes, agentsRes, invitesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/agents"),
        fetch("/api/invites"),
      ]);
      if (usersRes.ok) setAllUsers((await usersRes.json()).users ?? []);
      if (agentsRes.ok) setAgents((await agentsRes.json()).agents ?? []);
      if (invitesRes.ok) setInvites((await invitesRes.json()).invites ?? []);
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

  const fetchInvites = async () => {
    const res = await fetch("/api/invites");
    if (res.ok) setInvites((await res.json()).invites ?? []);
  };

  const handleDeleteAgent = async (agentId: string) => {
    const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (res.ok) setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  const handleDeleteHuman = async (userId: string) => {
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) setAllUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleChangeRole = async (userId: string, newRole: "owner" | "member") => {
    const res = await fetch(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, team_role: newRole } : u))
      );
    }
  };

  const isOwner = user?.team_role === "owner";

  const handleGenerateInvite = async () => {
    setInviteGenerating(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: inviteNote.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteResult(data);
        fetchInvites();
      }
    } finally {
      setInviteGenerating(false);
    }
  };

  const handleRevokeInvite = async (token: string) => {
    const res = await fetch(`/api/invites/${token}`, { method: "DELETE" });
    if (res.ok) fetchInvites();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      used: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      revoked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      pending: t("members.inviteStatusPending"),
      used: t("members.inviteStatusUsed"),
      expired: t("members.inviteStatusExpired"),
      revoked: t("members.inviteStatusRevoked"),
    };
    return (
      <span className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium ${styles[status] ?? styles.expired}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("members.title")} ({allUsers.length + agents.length})
        </h1>
        <div className="flex items-center gap-2">
          {/* Invite Member */}
          <Dialog open={inviteOpen} onOpenChange={(open) => {
            setInviteOpen(open);
            if (!open) {
              setInviteResult(null);
              setInviteNote("");
            }
          }}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <span className="hidden sm:inline">{t("members.inviteMember")}</span>
              <span className="sm:hidden">{t("members.mobileInvite")}</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("members.inviteTitle")}</DialogTitle>
              </DialogHeader>
              {inviteResult ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t("members.inviteLink")}</Label>
                    <div className="rounded-md bg-muted p-3">
                      <code className="text-xs font-mono break-all">{origin}/invite/{inviteResult.token}</code>
                    </div>
                  </div>
                  <CopyButton
                    className="w-full"
                    variant="outline"
                    size="default"
                    label={t("members.copyLink")}
                    text={`${origin}/invite/${inviteResult.token}`}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {t("members.inviteExpires").replace("{time}", "7 days")}
                  </p>
                  <Button className="w-full" onClick={() => {
                    setInviteOpen(false);
                    setInviteResult(null);
                    setInviteNote("");
                  }}>
                    {t("common.done")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t("members.inviteNote")}</Label>
                    <Input
                      placeholder={t("members.inviteNotePlaceholder")}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <Button className="w-full" onClick={handleGenerateInvite} disabled={inviteGenerating}>
                    {inviteGenerating ? t("common.creating") : t("members.generateLink")}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Hire Agent */}
          <Dialog open={registerAgentOpen} onOpenChange={(open) => {
            setRegisterAgentOpen(open);
            if (!open) setRegisterAgentResult(null);
          }}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <span className="hidden sm:inline">{t("members.registerAgent")}</span>
              <span className="sm:hidden">{t("members.mobileAgent")}</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
              <DialogHeader className="shrink-0">
                <DialogTitle>{t("members.registerAgentTitle")}</DialogTitle>
              </DialogHeader>
              {registerAgentResult ? (
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4 pt-2 pb-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">@{registerAgentResult.name}</span> {t("members.agentRegistered")}
                    </p>
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
                          {setupTab === "claude"
                            ? setupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)
                            : setupTab === "opencode"
                            ? openCodeSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)
                            : openClawSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)}
                        </pre>
                      </div>
                      <CopyButton
                        className="w-full"
                        label={t("members.copySetupPrompt")}
                        text={
                          setupTab === "claude"
                            ? setupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)
                            : setupTab === "opencode"
                            ? openCodeSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)
                            : openClawSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)
                        }
                      />
                    </div>
                    <div className="rounded bg-muted/50 border border-border p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t("members.token")}: <code className="font-mono text-foreground break-all">{registerAgentResult.token}</code>
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
              <MemberAvatar type="human" name={u.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{u.name}</span>
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">{t("members.you")}</span>
                  )}
                  {u.team_role === "owner" ? (
                    <span className="inline-flex h-5 items-center rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                      {t("members.owner")}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                      {t("members.member")}
                    </span>
                  )}
                  <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    {t("members.human")}
                  </span>
                </div>
                {u.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.description}</p>}
              </div>
              {isOwner && !isCurrentUser && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChangeRole(u.id, u.team_role === "owner" ? "member" : "owner");
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                    title={u.team_role === "owner" ? t("members.demoteToMember") : t("members.promoteToOwner")}
                  >
                    {u.team_role === "owner" ? t("members.demoteToMember") : t("members.promoteToOwner")}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteHuman({ id: u.id, name: u.name }); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
                    title={t("common.delete")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
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
            <MemberAvatar type="agent" name={agent.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">@{agent.name}</span>
                <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  {t("members.member")}
                </span>
                <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  {t("members.agent")}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {agent.description && (
                  <span className="text-xs text-muted-foreground truncate">{agent.description}</span>
                )}
                {agent.description && <span className="text-xs text-muted-foreground">&middot;</span>}
                <span className="text-xs text-muted-foreground shrink-0">{t("members.seen").replace("{time}", timeAgo(agent.last_seen_at))}</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteAgent({ id: agent.id, name: agent.name }); }}
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

      {/* Invite Links Section */}
      <div className="mt-8">
        <button
          onClick={() => setInvitesExpanded(!invitesExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${invitesExpanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          {t("members.inviteLinks")} ({invites.length})
        </button>

        {invitesExpanded && (
          <div className="mt-3 divide-y divide-border rounded-md border border-border overflow-y-auto">
            {invites.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">{t("members.noInvites")}</p>
              </div>
            ) : (
              invites.map((inv) => (
                <div key={inv.token} className="flex items-center gap-3 px-3 sm:px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(inv.status)}
                      {inv.note && <span className="text-xs text-muted-foreground truncate">{inv.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{inv.creator_name ?? "Unknown"}</span>
                      <span>&middot;</span>
                      <span>{timeAgo(inv.created_at)}</span>
                      {inv.status === "pending" && (
                        <>
                          <span>&middot;</span>
                          <span>{t("members.inviteExpires").replace("{time}", timeAgo(inv.expires_at).replace(" ago", ""))}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inv.status === "pending" && (
                      <>
                        <CopyButton
                          label={t("members.copyLink")}
                          text={`${origin}/invite/${inv.token}`}
                          size="sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevokeInvite(inv.token)}
                        >
                          {t("members.revokeInvite")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteAgent}
        onOpenChange={(open) => { if (!open) setConfirmDeleteAgent(null); }}
        title={t("members.confirmDeleteAgent").replace("{name}", confirmDeleteAgent?.name ?? "")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmDeleteAgent) {
            await handleDeleteAgent(confirmDeleteAgent.id);
          }
          setConfirmDeleteAgent(null);
        }}
      />
      <ConfirmDialog
        open={!!confirmDeleteHuman}
        onOpenChange={(open) => { if (!open) setConfirmDeleteHuman(null); }}
        title={t("members.confirmDeleteHuman").replace("{name}", confirmDeleteHuman?.name ?? "")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmDeleteHuman) {
            await handleDeleteHuman(confirmDeleteHuman.id);
          }
          setConfirmDeleteHuman(null);
        }}
      />
    </main>
  );
}
