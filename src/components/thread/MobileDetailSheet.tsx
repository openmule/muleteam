"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ActionItems } from "./ActionItems";
import { WorkspaceFiles } from "./WorkspaceFiles";
import { ParticipantsList } from "./ParticipantsList";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n";

interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

interface ActionItemData {
  id: string;
  description: string;
  assignee?: string;
  assignee_name?: string;
  status: "open" | "in_progress" | "done";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  source_message_id?: string;
}

interface WorkspaceFile {
  name: string;
  size: number;
  modified: string;
}

interface RegisteredAgent {
  id: string;
  name: string;
  last_seen_at: string;
  capabilities?: string[];
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface MobileDetailSheetProps {
  threadId: string;
  tasks: ActionItemData[];
  files: WorkspaceFile[];
  participants: Participant[];
  agents: RegisteredAgent[];
  users: UserInfo[];
  readOnly: boolean;
  onRefreshTasks: () => void;
  onRefreshFiles: () => void;
  onParticipantAdded: () => void;
}

export function MobileDetailSheet({
  threadId,
  tasks,
  files,
  participants,
  agents,
  users,
  readOnly,
  onRefreshTasks,
  onRefreshFiles,
  onParticipantAdded,
}: MobileDetailSheetProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const currentTranslateY = useRef(0);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only allow dragging from the handle area (top 40px of sheet)
    const touch = e.touches[0];
    const sheetRect = sheetRef.current?.getBoundingClientRect();
    if (!sheetRect) return;
    // Allow drag from top 48px (the handle + header area)
    if (touch.clientY - sheetRect.top > 48) return;
    setIsDragging(true);
    dragStartY.current = touch.clientY;
    currentTranslateY.current = 0;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const delta = e.touches[0].clientY - dragStartY.current;
      // Only allow dragging downward
      const clamped = Math.max(0, delta);
      currentTranslateY.current = clamped;
      setTranslateY(clamped);
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    // If dragged more than 100px down, close the sheet
    if (currentTranslateY.current > 100) {
      setOpen(false);
    }
    setTranslateY(0);
    currentTranslateY.current = 0;
  }, [isDragging]);

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <>
      {/* Trigger button - only visible on mobile (hidden on md+) */}
      <button
        type="button"
        className="md:hidden flex items-center gap-1 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(true)}
        aria-label={t("thread.details")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        {openCount > 0 && (
          <span className="text-xs font-medium bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
            {openCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          style={{
            transition: isDragging ? "none" : "opacity 200ms ease-out",
          }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-50 md:hidden bg-background rounded-t-xl shadow-xl border-t border-border flex flex-col ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          maxHeight: "70dvh",
          transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
          transform: open
            ? `translateY(${translateY}px)`
            : "translateY(100%)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t("thread.details")}</h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors"
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content with tabs */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <Tabs defaultValue={0}>
            <TabsList variant="line" className="w-full justify-start px-3 pt-1 shrink-0">
              <TabsTrigger value={0} className="text-xs gap-1">
                {t("sidebar.actionItems")}
                {openCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">({openCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value={1} className="text-xs">
                {t("sidebar.participants")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value={0}>
              <ActionItems
                threadId={threadId}
                tasks={tasks}
                participants={participants}
                onRefresh={onRefreshTasks}
                readOnly={readOnly}
                embedded
              />
            </TabsContent>
            <TabsContent value={1}>
              <ParticipantsList
                threadId={threadId}
                participants={participants}
                agents={agents}
                users={users}
                onParticipantAdded={onParticipantAdded}
                readOnly={readOnly}
                embedded
              />
            </TabsContent>
          </Tabs>

          <WorkspaceFiles
            threadId={threadId}
            files={files}
            onRefresh={onRefreshFiles}
            readOnly={readOnly}
          />
        </div>
      </div>
    </>
  );
}
