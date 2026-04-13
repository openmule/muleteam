"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { ChatInput } from "@/components/ui/chat-input";
import {
  MentionAutocomplete,
  type MentionMember,
} from "@/components/shared/MentionAutocomplete";
import { useT } from "@/lib/i18n";

interface ReplyContext {
  id: string;
  from_name: string;
  body: string;
}

interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

interface ThreadChatInputProps {
  threadId: string;
  participants?: Participant[];
  replyTo?: ReplyContext | null;
  onCancelReply?: () => void;
  onSend: (body: string, replyTo?: string) => Promise<void>;
}

export function ThreadChatInput({
  threadId,
  participants,
  replyTo,
  onCancelReply,
  onSend,
}: ThreadChatInputProps) {
  const t = useT();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  // Mention autocomplete state
  const [mentionVisible, setMentionVisible] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionStartRef = useRef<number>(-1);
  // We need a ref to track cursor position since ChatInput doesn't expose the textarea ref
  const valueRef = useRef(value);
  valueRef.current = value;

  // Build member list for mention autocomplete (thread participants only)
  const mentionMembers = useMemo<MentionMember[]>(() => {
    const seen = new Set<string>();
    const members: MentionMember[] = [];
    for (const p of participants ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      members.push({
        id: p.id,
        name: p.name,
        type: p.type,
        isParticipant: true,
      });
    }
    return members;
  }, [participants]);

  // Extract mention query from cursor position in the input text
  const detectMention = useCallback(
    (text: string, cursorPos: number) => {
      const textBeforeCursor = text.slice(0, cursorPos);
      const atIdx = textBeforeCursor.lastIndexOf("@");
      if (atIdx === -1) {
        setMentionVisible(false);
        mentionStartRef.current = -1;
        return;
      }

      // `@` must be at the start or preceded by whitespace
      if (atIdx > 0 && !/\s/.test(textBeforeCursor[atIdx - 1])) {
        setMentionVisible(false);
        mentionStartRef.current = -1;
        return;
      }

      const query = textBeforeCursor.slice(atIdx + 1);
      // If the query contains a space/newline, the mention is "complete" — dismiss
      if (query.includes(" ") || query.includes("\n")) {
        setMentionVisible(false);
        mentionStartRef.current = -1;
        return;
      }

      mentionStartRef.current = atIdx;
      setMentionQuery(query);
      setMentionIndex(0);
      setMentionVisible(true);
    },
    []
  );

  const handleMentionSelect = useCallback(
    (name: string) => {
      const atIdx = mentionStartRef.current;
      if (atIdx === -1) return;

      const currentValue = valueRef.current;
      const before = currentValue.slice(0, atIdx);
      // Find where the cursor would be (end of current query)
      const queryEnd = atIdx + 1 + mentionQuery.length;
      const after = currentValue.slice(queryEnd);
      const mention = name.includes(" ") ? `@[${name}]` : `@${name}`;
      const newText = `${before}${mention} ${after}`;
      setValue(newText);
      setMentionVisible(false);
      mentionStartRef.current = -1;
    },
    [mentionQuery]
  );

  // Get the filtered+sorted members for keyboard nav
  const getFilteredMembers = useCallback(() => {
    return mentionMembers
      .filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (a.isParticipant !== b.isParticipant)
          return a.isParticipant ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [mentionMembers, mentionQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention autocomplete keyboard navigation
    if (mentionVisible) {
      const filtered = getFilteredMembers();
      const count = filtered.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % Math.max(count, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + Math.max(count, 1)) % Math.max(count, 1));
        return;
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (count > 0) {
          e.preventDefault();
          if (filtered[mentionIndex]) {
            handleMentionSelect(filtered[mentionIndex].name);
          }
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionVisible(false);
        mentionStartRef.current = -1;
        return;
      }
      if (e.key === "Tab" && count > 0) {
        e.preventDefault();
        if (filtered[mentionIndex]) {
          handleMentionSelect(filtered[mentionIndex].name);
        }
        return;
      }
    }

    // Escape to cancel reply
    if (e.key === "Escape" && replyTo) {
      onCancelReply?.();
    }
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
    // Detect mention from the end of the new value (approximate cursor position)
    // This works because onChange fires after the character is inserted at cursor
    detectMention(newValue, newValue.length);
  };

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed, replyTo?.id);
      setValue("");
      onCancelReply?.();
    } finally {
      setSending(false);
    }
  };

  const headerContent = (
    <>
      {/* Reply context bar */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 text-xs text-[var(--label-tertiary)]">
          <span>
            {t("thread.replyingTo")}{" "}
            <span className="font-medium text-[var(--label-primary)]">
              {replyTo.from_name}
            </span>
          </span>
          <span className="truncate max-w-[200px]">
            {replyTo.body.slice(0, 60)}
            {replyTo.body.length > 60 ? "..." : ""}
          </span>
          <button
            onClick={onCancelReply}
            className="ml-auto text-[var(--label-tertiary)] hover:text-[var(--label-primary)]"
          >
            &times;
          </button>
        </div>
      )}

      {/* Mention autocomplete */}
      {mentionVisible && (
        <div className="relative">
          <MentionAutocomplete
            members={mentionMembers}
            query={mentionQuery}
            visible={mentionVisible}
            selectedIndex={mentionIndex}
            onSelect={handleMentionSelect}
            onHover={setMentionIndex}
          />
        </div>
      )}
    </>
  );

  return (
    <ChatInput
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSend={handleSend}
      loading={sending}
      placeholder={
        replyTo
          ? t("thread.replyToPlaceholder").replace("{name}", replyTo.from_name)
          : t("thread.writeComment")
      }
      size="sm"
      headerContent={headerContent}
    />
  );
}
