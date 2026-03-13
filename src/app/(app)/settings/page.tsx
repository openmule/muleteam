"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  const [humanCount, setHumanCount] = useState(0);
  const [agentCount, setAgentCount] = useState(0);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.users) setHumanCount(data.users.length);
      })
      .catch(() => {});
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.agents) setAgentCount(data.agents.length);
      })
      .catch(() => {});
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const totalMembers = humanCount + agentCount;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight mb-8">{t("settings.title")}</h1>

      {/* Team Info */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.teamInfo")}</h2>
        <div className="rounded-md border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("settings.teamName")}</span>
            <span className="text-sm font-medium">MuleTeam</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("settings.members")}</span>
            <span className="text-sm font-medium">
              {totalMembers} ({humanCount} {t("members.human").toLowerCase()}, {agentCount} {t("members.agent").toLowerCase()})
            </span>
          </div>
        </div>
      </section>

      {/* Plan & Billing */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.planAndBilling")}</h2>
        <div className="rounded-md border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("settings.currentPlan")}: {t("settings.freePlan")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("settings.freePlanDesc")}</p>
            </div>
            <Button variant="outline" size="sm" disabled>
              {t("settings.upgrade")}
            </Button>
          </div>
        </div>
      </section>

      {/* Owner Info */}
      {user && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("settings.account")}</h2>
          <div className="rounded-md border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("auth.name")}</span>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("auth.email")}</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
