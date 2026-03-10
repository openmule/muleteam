"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function CopyButton({
  text,
  label,
  className,
  variant = "outline",
  size = "sm",
}: {
  text: string;
  label: string;
  className?: string;
  variant?: "outline" | "default";
  size?: "sm" | "default";
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? t("common.copied") : label}
    </Button>
  );
}
