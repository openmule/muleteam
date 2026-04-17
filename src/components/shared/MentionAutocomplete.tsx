"use client";

import { useEffect, useRef, useCallback } from "react";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { useT } from "@/lib/i18n";

export interface MentionMember {
  id: string;
  name: string;
  type: "human" | "agent";
  isParticipant: boolean;
}

interface MentionAutocompleteProps {
  members: MentionMember[];
  query: string;
  visible: boolean;
  selectedIndex: number;
  onSelect: (name: string) => void;
  onHover: (index: number) => void;
}

const MAX_VISIBLE = 8;

export function MentionAutocomplete({
  members,
  query,
  visible,
  selectedIndex,
  onSelect,
  onHover,
}: MentionAutocompleteProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter members by query (case-insensitive substring match)
  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  // Sort: participants first, then others; within each group sort alphabetically
  const sorted = [...filtered].sort((a, b) => {
    if (a.isParticipant !== b.isParticipant) {
      return a.isParticipant ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  // Scroll selected item into view
  useEffect(() => {
    if (!visible || sorted.length === 0) return;
    const item = itemRefs.current[selectedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, visible, sorted.length]);

  const handleClick = useCallback(
    (name: string) => {
      onSelect(name);
    },
    [onSelect]
  );

  if (!visible || sorted.length === 0) {
    if (!visible) return null;
    // Show "no results" when visible but empty
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
        <div
          className="bg-[var(--bg-grouped-quaternary)] border-[length:var(--border-width-primary)] border-border rounded-[8px] p-2"
          style={{ boxShadow: "var(--shadow-medium)" }}
        >
          <div className="text-xs text-muted-foreground px-2 py-1">
            {t("mention.noResults")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div
        ref={listRef}
        className="bg-[var(--bg-grouped-quaternary)] border-[length:var(--border-width-primary)] border-border rounded-[8px] p-2 overflow-y-auto"
        style={{ maxHeight: MAX_VISIBLE * 44, boxShadow: "var(--shadow-medium)" }}
        role="listbox"
      >
        {sorted.map((member, index) => (
          <button
            key={member.id}
            ref={(el) => { itemRefs.current[index] = el; }}
            role="option"
            aria-selected={index === selectedIndex}
            className={`w-full flex items-center gap-2 h-9 px-2 text-[length:var(--font-size-body-small)] text-left rounded-[var(--radius-h36)] transition-colors ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-[var(--fill-quaternary)]"
            }`}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(e) => {
              // Prevent textarea blur
              e.preventDefault();
              handleClick(member.name);
            }}
          >
            <MemberAvatar type={member.type} name={member.name} size={24} />
            <span className="truncate flex-1">{member.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                member.type === "agent"
                  ? "bg-[var(--color-blue-100)] text-[var(--color-blue-1000)]"
                  : "bg-[var(--fill-quaternary)] text-[var(--label-secondary)]"
              }`}
            >
              {member.type === "agent" ? "Agent" : "Human"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
