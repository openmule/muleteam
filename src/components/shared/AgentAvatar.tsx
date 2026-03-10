"use client";

// Deterministic bot avatar using DiceBear API
export function AgentAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const url = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
  return (
    <img
      src={url}
      alt={`@${name}`}
      width={size}
      height={size}
      className="rounded-full bg-muted shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
