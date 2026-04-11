"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { locale, t } = useI18n();
  const [humanCount, setHumanCount] = useState(0);
  const [agentCount, setAgentCount] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [dataLocale, setDataLocale] = useState<"en" | "zh">("zh");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.users) setHumanCount(data.users.length); })
      .catch(() => {});
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.agents) setAgentCount(data.agents.length); })
      .catch(() => {});
    // Detect current data language from first thread title
    fetch("/api/threads")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const threads = data?.threads ?? [];
        if (threads.length > 0) {
          const hasChineseChar = /[\u4e00-\u9fff]/.test(threads[0].title);
          setDataLocale(hasChineseChar ? "zh" : "en");
        }
      })
      .catch(() => {});
  }, []);

  const handleReseed = async (seedLocale: "en" | "zh") => {
    if (seedLocale === dataLocale) return;
    setSeeding(true);
    try {
      await fetch(`/api/seed?locale=${seedLocale}`, { method: "POST" });
      setDataLocale(seedLocale);
      window.location.reload();
    } catch {
      setSeeding(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-[var(--label-secondary)] text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const totalMembers = humanCount + agentCount;

  return (
    <main className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[800px] w-full">
        {/* Title area */}
        <div className="flex flex-col gap-3 pt-20 pb-10">
          <h1 className="text-[length:var(--font-size-title-page)] font-bold leading-[1.2] text-[var(--label-primary)]">Settings</h1>
          <p className="text-sm text-[var(--label-secondary)]">Manage your team, account, and preferences.</p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-6">
          {/* ── Team ── */}
          <div className="flex flex-col">
            <div className="flex items-center py-5 border-b border-[var(--border-color-primary)]">
              <span className="text-[length:var(--font-size-heading)] font-semibold leading-[1.5] text-[var(--label-primary)]">Team</span>
            </div>
            <div className="flex items-center justify-between py-5 border-b border-[var(--border-color-primary)]">
              <span className="text-[length:var(--font-size-body-base)] text-[var(--label-primary)]">Team Name</span>
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-[var(--label-tertiary)]" strokeWidth={1.5} />
                <span className="text-[length:var(--font-size-body-base)] text-[var(--label-secondary)]">MuleTeam</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-5 border-b border-[var(--border-color-primary)]">
              <span className="text-[length:var(--font-size-body-base)] text-[var(--label-primary)]">Members</span>
              <span className="text-[length:var(--font-size-body-base)] text-[var(--label-secondary)]">
                {totalMembers} ({humanCount} human, {agentCount} agent)
              </span>
            </div>
          </div>

          {/* ── Plan & Billing ── */}
          <div className="flex flex-col">
            <div className="flex items-center py-5">
              <span className="text-[length:var(--font-size-heading)] font-semibold leading-[1.5] text-[var(--label-primary)]">Plan & Billing</span>
            </div>
            <div className="flex items-center justify-between p-5 rounded-[12px] bg-[var(--color-olive-1000)]">
              <div className="flex flex-col gap-1">
                <p className="text-[length:var(--font-size-subheading)] leading-[1.5] text-white">Current plan: Free</p>
                <p className="text-sm text-white/40">Unlimited members and threads. Upgrade for advanced features.</p>
              </div>
              <button className="h-8 px-3 rounded-[8px] bg-white text-[length:var(--font-size-body-base)] text-[var(--color-olive-1000)] hover:bg-white/90 transition-colors cursor-pointer shrink-0">
                Upgrade
              </button>
            </div>
          </div>

          {/* ── Account ── */}
          {user && (
            <div className="flex flex-col">
              <div className="flex items-center py-5 border-b border-[var(--border-color-primary)]">
                <span className="text-[length:var(--font-size-heading)] font-semibold leading-[1.5] text-[var(--label-primary)]">Account</span>
              </div>
              <div className="flex items-center justify-between py-5 border-b border-[var(--border-color-primary)]">
                <span className="text-[length:var(--font-size-body-base)] text-[var(--label-primary)]">Name</span>
                <div className="flex items-center gap-2">
                  <Pencil className="size-4 text-[var(--label-tertiary)]" strokeWidth={1.5} />
                  <span className="text-[length:var(--font-size-body-base)] text-[var(--label-secondary)]">{user.name}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-5 border-b border-[var(--border-color-primary)]">
                <span className="text-[length:var(--font-size-body-base)] text-[var(--label-primary)]">Email</span>
                <span className="text-[length:var(--font-size-body-base)] text-[var(--label-secondary)]">{user.email}</span>
              </div>
            </div>
          )}

          {/* ── Demo Data ── */}
          <div className="flex flex-col pb-20">
            <div className="flex items-center py-5 border-b border-[var(--border-color-primary)]">
              <span className="text-[length:var(--font-size-heading)] font-semibold leading-[1.5] text-[var(--label-primary)]">Demo Data</span>
            </div>
            <div className="flex items-center justify-between py-5 border-b border-[var(--border-color-primary)]">
              <div className="flex flex-col gap-1">
                <span className="text-[length:var(--font-size-body-base)] text-[var(--label-primary)]">Data Language</span>
                <span className="text-sm text-[var(--label-secondary)]">Regenerate all demo data (threads, channels, messages) in the selected language.</span>
              </div>
              <Select
                value={dataLocale}
                onValueChange={(val) => handleReseed(val as "en" | "zh")}
                disabled={seeding}
              >
                <SelectTrigger className="w-[120px] h-8 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
