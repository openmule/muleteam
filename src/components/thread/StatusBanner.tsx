"use client";

interface StatusBannerProps {
  status: string;
  statusLabel?: string;
  statusDetail?: string;
  description?: string;
}

function statusStyles(status: string) {
  switch (status) {
    case "in_progress":
      return {
        bg: "bg-[var(--color-orange-100)]",
        dotColor: "text-[var(--color-orange-1000)]",
        labelColor: "text-[var(--color-orange-1000)]",
      };
    case "done":
      return {
        bg: "bg-[var(--color-green-100)]",
        dotColor: "text-[var(--color-green-1000)]",
        labelColor: "text-[var(--color-green-1000)]",
      };
    case "archived":
      return {
        bg: "bg-[var(--fill-quaternary)]",
        dotColor: "text-[var(--label-tertiary)]",
        labelColor: "text-[var(--label-tertiary)]",
      };
    default: // open
      return {
        bg: "bg-[var(--color-cyan-100)]",
        dotColor: "text-[var(--color-cyan-1000)]",
        labelColor: "text-[var(--color-cyan-1000)]",
      };
  }
}

export function StatusBanner({ status, statusLabel, statusDetail, description }: StatusBannerProps) {
  if (!statusLabel && !description) return null;

  const styles = statusStyles(status);
  const detail = statusDetail || description;

  return (
    <div className={`${styles.bg} flex items-start gap-2 p-2 rounded-[8px] w-full`}>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-xs ${styles.dotColor}`}>●</span>
        <span className={`text-sm font-semibold ${styles.labelColor} whitespace-nowrap`}>
          {statusLabel || status}
        </span>
      </div>
      {detail && (
        <p className="text-sm text-[var(--label-secondary)] truncate flex-1">
          {detail}
        </p>
      )}
    </div>
  );
}
