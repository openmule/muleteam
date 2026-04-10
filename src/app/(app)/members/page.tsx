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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical, UserPlus, Bot, Shield, Trash2 } from "lucide-react";
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
      pending: "bg-[var(--color-yellow-100)] text-[var(--color-yellow-1000)]",
      used: "bg-[var(--color-green-100)] text-[var(--color-green-1000)]",
      expired: "bg-[var(--fill-quaternary)] text-[var(--label-secondary)]",
      revoked: "bg-[var(--color-red-100)] text-[var(--color-red-1000)]",
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
    <main className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[800px] w-full">
        {/* Title area */}
        <div className="flex items-start justify-between pt-20 pb-10">
          <div className="flex flex-col gap-3">
            <h1 className="text-[length:var(--font-size-title-page)] font-bold leading-[1.2] text-[var(--label-primary)]">Members</h1>
            <p className="text-sm text-[var(--label-secondary)]">Manage team members and AI agents.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline-filled" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" strokeWidth={1.5} /> Invite Member
            </Button>
            <Button variant="outline-filled" size="sm" onClick={() => setRegisterAgentOpen(true)}>
              <Bot className="h-4 w-4 mr-1" strokeWidth={1.5} /> Hire Agent
            </Button>
          </div>
        </div>

        {/* Members list */}
        <div className="flex flex-col pb-20">
          {/* Humans */}
          {allUsers.map((u) => {
            const isCurrentUser = u.id === user?.id;
            return (
              <div
                key={`human:${u.id}`}
                className="group flex items-center gap-3 py-4 border-b border-[var(--border-color-primary)] cursor-pointer"
                onClick={() => router.push(memberUrl(`human:${u.id}`))}
              >
                <MemberAvatar type="human" name={u.name} size={48} avatarUrl={u.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[length:var(--font-size-body-base)] font-[500] text-[var(--label-primary)]">{u.name}</span>
                    <span className="bg-[var(--color-green-100)] text-[var(--color-green-1000)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">Human</span>
                    {u.team_role === "owner" && (
                      <span className="bg-[var(--fill-quaternary)] text-[var(--label-secondary)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">owner</span>
                    )}
                    {isCurrentUser && (
                      <span className="text-xs text-[var(--label-tertiary)]">{t("members.you")}</span>
                    )}
                  </div>
                  {u.description && (
                    <p className="text-[length:var(--font-size-body-small)] text-[var(--label-secondary)] truncate">{u.description}</p>
                  )}
                </div>
                {isOwner && !isCurrentUser && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-[6px] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)] transition-all focus:outline-none cursor-pointer">
                        <EllipsisVertical className="size-5" strokeWidth={1.5} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4} className="w-[180px]">
                        <DropdownMenuItem onSelect={() => handleChangeRole(u.id, u.team_role === "owner" ? "member" : "owner")}>
                          <Shield className="h-4 w-4" strokeWidth={1.5} />
                          {u.team_role === "owner" ? t("members.demoteToMember") : t("members.promoteToOwner")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setConfirmDeleteHuman({ id: u.id, name: u.name })} className="text-destructive focus:text-destructive focus:bg-[var(--color-red-100)]">
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} /> {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })}

          {/* Agents */}
          {agents.map((agent) => (
            <div
              key={`agent:${agent.id}`}
              className="group flex items-start gap-3 py-4 border-b border-[var(--border-color-primary)] cursor-pointer"
              onClick={() => router.push(memberUrl(`agent:${agent.id}`))}
            >
              <MemberAvatar type="agent" name={agent.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[length:var(--font-size-body-base)] font-[500] text-[var(--label-primary)]">{agent.name}</span>
                  <span className="bg-[var(--color-orange-100)] text-[var(--color-orange-1000)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">Agent</span>
                  {agent.capabilities?.map((tag) => (
                    <span key={tag} className="bg-[var(--fill-quaternary)] text-[var(--label-secondary)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">{tag}</span>
                  ))}
                </div>
                {agent.description && (
                  <p className="text-[length:var(--font-size-body-small)] text-[var(--label-secondary)] truncate">{agent.description}</p>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-[6px] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)] transition-all focus:outline-none cursor-pointer">
                    <EllipsisVertical className="size-5" strokeWidth={1.5} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-[180px]">
                    <DropdownMenuItem onSelect={() => setConfirmDeleteAgent({ id: agent.id, name: agent.name })} className="text-destructive focus:text-destructive focus:bg-[var(--color-red-100)]">
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} /> {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {allUsers.length === 0 && agents.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--label-secondary)]">{t("members.noMembers")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs — kept outside the scrollable area */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) { setInviteResult(null); setInviteNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("members.inviteTitle")}</DialogTitle></DialogHeader>
          {inviteResult ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t("members.inviteLink")}</Label>
                <div className="rounded-md bg-muted p-3">
                  <code className="text-xs font-mono break-all">{origin}/invite/{inviteResult.token}</code>
                </div>
              </div>
              <CopyButton className="w-full" variant="outline" size="default" label={t("members.copyLink")} text={`${origin}/invite/${inviteResult.token}`} />
              <p className="text-xs text-muted-foreground text-center">{t("members.inviteExpires").replace("{time}", "7 days")}</p>
              <Button className="w-full" onClick={() => { setInviteOpen(false); setInviteResult(null); setInviteNote(""); }}>{t("common.done")}</Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t("members.inviteNote")}</Label>
                <Input placeholder={t("members.inviteNotePlaceholder")} value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} autoFocus />
              </div>
              <Button className="w-full" onClick={handleGenerateInvite} disabled={inviteGenerating}>{inviteGenerating ? t("common.creating") : t("members.generateLink")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={registerAgentOpen} onOpenChange={(open) => { setRegisterAgentOpen(open); if (!open) setRegisterAgentResult(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0"><DialogTitle>{t("members.registerAgentTitle")}</DialogTitle></DialogHeader>
          {registerAgentResult ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pt-2 pb-2">
                <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">@{registerAgentResult.name}</span> {t("members.agentRegistered")}</p>
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex gap-1 mb-2">
                    {(["claude", "opencode", "openclaw"] as const).map((tab) => (
                      <button key={tab} onClick={() => setSetupTab(tab)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${setupTab === tab ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                        {tab === "claude" ? t("members.tabClaudeCode") : tab === "opencode" ? t("members.tabOpenCode") : t("members.tabOpenClaw")}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-medium">{setupTab === "claude" ? t("members.pasteSetupPrompt") : setupTab === "opencode" ? t("members.pasteOpenCode") : t("members.pasteOpenClaw")}</p>
                  <div className="rounded bg-muted p-2 max-h-48 overflow-y-auto">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed break-all">
                      {setupTab === "claude" ? setupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description) : setupTab === "opencode" ? openCodeSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description) : openClawSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)}
                    </pre>
                  </div>
                  <CopyButton className="w-full" label={t("members.copySetupPrompt")} text={setupTab === "claude" ? setupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description) : setupTab === "opencode" ? openCodeSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description) : openClawSetupPrompt(origin, registerAgentResult.name, registerAgentResult.token, registerAgentResult.description)} />
                </div>
                <div className="rounded bg-muted/50 border border-border p-2">
                  <p className="text-[11px] text-muted-foreground">{t("members.token")}: <code className="font-mono text-foreground break-all">{registerAgentResult.token}</code></p>
                </div>
                <Button className="w-full" onClick={() => { setRegisterAgentOpen(false); setRegisterAgentResult(null); fetchAgents(); }}>{t("common.done")}</Button>
              </div>
            </ScrollArea>
          ) : (
            <RegisterAgentForm onSuccess={(name, token, description) => { setRegisterAgentResult({ name, token, description }); fetchAgents(); }} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDeleteAgent} onOpenChange={(open) => { if (!open) setConfirmDeleteAgent(null); }} title={t("members.confirmDeleteAgent").replace("{name}", confirmDeleteAgent?.name ?? "")} variant="destructive" onConfirm={async () => { if (confirmDeleteAgent) await handleDeleteAgent(confirmDeleteAgent.id); setConfirmDeleteAgent(null); }} />
      <ConfirmDialog open={!!confirmDeleteHuman} onOpenChange={(open) => { if (!open) setConfirmDeleteHuman(null); }} title={t("members.confirmDeleteHuman").replace("{name}", confirmDeleteHuman?.name ?? "")} variant="destructive" onConfirm={async () => { if (confirmDeleteHuman) await handleDeleteHuman(confirmDeleteHuman.id); setConfirmDeleteHuman(null); }} />
    </main>
  );
}
