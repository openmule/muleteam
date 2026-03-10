"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function JoinButton({
  threadId,
  onJoined,
}: {
  threadId: string;
  onJoined: () => void;
}) {
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
        Join this thread to participate
      </span>
      <Button size="sm" onClick={handleJoin} disabled={joining}>
        {joining ? "Joining..." : "Join"}
      </Button>
    </div>
  );
}
