"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { EventFeed } from "@/components/shared/EventFeed";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { NotificationEvent } from "@/components/shared/types";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const eventsRes = await fetch("/api/events?limit=30");
      if (eventsRes.ok) setEvents((await eventsRes.json()).events ?? []);
      setLoading(false);
    }
    load();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const handleMarkRead = async (eventId: string) => {
    await fetch(`/api/events/${eventId}`, { method: "PATCH" });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, read: true } : e)));
    window.dispatchEvent(new Event("muleteam:events-changed"));
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/events/read-all", { method: "POST" });
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
    window.dispatchEvent(new Event("muleteam:events-changed"));
  };

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between h-10 mb-4">
        <h2 className="text-[length:var(--font-size-heading)] font-semibold">{t("home.forYou")}</h2>
        {events.some(e => !e.read) && (
          <Button variant="ghost" size="xs" onClick={handleMarkAllRead}>
            {t("events.markAllRead")}
          </Button>
        )}
      </div>
      <EventFeed events={events} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} />
    </main>
  );
}
