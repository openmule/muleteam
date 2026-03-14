// Shared utility functions for MuleTeam

export const STATUS_ICON: Record<string, string> = {
  open: "\u25CB",
  in_progress: "\u25CF",
  done: "\u2713",
  archived: "\u2014",
};

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Build a clean profile URL: /members/agent/<id> or /members/human/<id> */
export function memberUrl(participantId: string): string {
  // participantId is "agent:<id>" or "human:<id>"
  const [type, ...rest] = participantId.split(":");
  return `/members/${type}/${rest.join(":")}`;
}

export function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}
