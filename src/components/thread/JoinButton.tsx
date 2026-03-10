"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function JoinButton({
  threadId,
  onJoined,
}: {
  threadId: string;
  onJoined: () => void;
}) {
  const t = useT();
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/join`, {
        method: "POST",
      });
      if (res.ok) {
        onJoined();
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
      <span className="text-sm text-muted-foreground">
        {t("thread.joinToParticipate")}
      </span>
      <Button size="sm" onClick={handleJoin} disabled={joining}>
        {joining ? t("common.joining") : t("common.join")}
      </Button>
    </div>
  );
}
