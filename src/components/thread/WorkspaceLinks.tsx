"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

interface HyperlinkEntry {
  id: string;
  url: string;
  title: string;
  type: string;
  added_by: string;
  added_at: string;
}

export function WorkspaceLinks({
  threadId,
  links,
  onRefresh,
  readOnly = false,
}: {
  threadId: string;
  links: HyperlinkEntry[];
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/threads/${threadId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), title: newTitle.trim() || undefined }),
      });
      setNewUrl("");
      setNewTitle("");
      setShowAdd(false);
      onRefresh();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="border-b border-border">
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          {t("sidebar.links")}
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {links.length === 0 && !showAdd && (
            <p className="text-xs text-muted-foreground py-2">{t("sidebar.noLinks")}</p>
          )}
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1 text-sm hover:underline group"
            >
              <span className="text-muted-foreground">&rarr;</span>
              <span className="truncate">{link.title}</span>
            </a>
          ))}

          {!readOnly && (showAdd ? (
            <div className="mt-2 space-y-2 rounded-md border border-border p-3">
              <Input
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="text-sm h-8"
              />
              <Input
                placeholder={t("sidebar.linkTitlePlaceholder")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-sm h-8"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={adding || !newUrl.trim()}>
                  {adding ? "..." : t("common.add")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="text-xs text-muted-foreground hover:text-foreground mt-1"
              onClick={() => setShowAdd(true)}
            >
              {t("sidebar.addLink")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
