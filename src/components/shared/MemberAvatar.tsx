"use client";

import { getInitials } from "@/components/shared/helpers";

/**
 * Unified avatar component for all member types.
 *
 * - Human: black circle (bg-foreground) with white initials (text-background)
 * - Agent: DiceBear bottts-neutral image with a small bot badge in the bottom-right corner
 *
 * @param type   "human" or "agent"
 * @param name   Display name (used for initials / DiceBear seed)
 * @param size   Pixel size of the avatar circle (default 32)
 */
export function MemberAvatar({
  type,
  name,
  size = 32,
  avatarUrl,
}: {
  type: "human" | "agent";
  name: string;
  size?: number;
  avatarUrl?: string | null;
}) {
  // Responsive font size based on avatar size
  const fontSize =
    size <= 20
      ? 9
      : size <= 28
        ? 10
        : size <= 32
          ? 11
          : size >= 48
            ? 16
            : 12;

  if (type === "human") {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className="inline-flex rounded-full object-cover shrink-0"
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <span
        className="flex items-center justify-center rounded-full bg-foreground text-background font-medium shrink-0 leading-none"
        style={{ width: size, height: size, fontSize }}
      >
        {getInitials(name)}
      </span>
    );
  }

  // Agent: DiceBear image + bot badge
  const url = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
  const showBadge = false;
  // Badge scales with avatar size
  const badgeSize = Math.max(10, Math.round(size * 0.38));

  return (
    <span
      className="relative inline-flex shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt={`@${name}`}
        width={size}
        height={size}
        className="rounded-full bg-muted object-cover"
        style={{ width: size, height: size }}
      />
      {showBadge && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-foreground text-background"
          style={{
            width: badgeSize,
            height: badgeSize,
            bottom: -1,
            right: -1,
          }}
        >
          <svg
            width={Math.round(badgeSize * 0.6)}
            height={Math.round(badgeSize * 0.6)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Simple bot/CPU icon */}
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <line x1="9" y1="9" x2="9" y2="9.01" />
            <line x1="15" y1="9" x2="15" y2="9.01" />
            <path d="M9 15h6" />
          </svg>
        </span>
      )}
    </span>
  );
}
