"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  }, []);
}

interface ReplyContext {
  id: string;
  from_name: string;
  body: string;
}

export function CommentInput({
  onSubmit,
  disabled,
  replyTo,
  onCancelReply,
}: {
  onSubmit: (body: string, replyTo?: string) => Promise<void>;
  disabled?: boolean;
  replyTo?: ReplyContext | null;
  onCancelReply?: () => void;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMac = useIsMac();

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await onSubmit(input.trim(), replyTo?.id);
      setInput("");
      onCancelReply?.();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyTo) {
      onCancelReply?.();
    }
  };

  return (
    <div className="px-6 py-4 border-t border-border">
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <span>{t("thread.replyingTo")} <span className="font-medium text-foreground">{replyTo.from_name}</span></span>
          <span className="truncate max-w-[200px]">{replyTo.body.slice(0, 60)}{replyTo.body.length > 60 ? "..." : ""}</span>
          <button
            onClick={onCancelReply}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          placeholder={replyTo ? t("thread.replyToPlaceholder").replace("{name}", replyTo.from_name) : t("thread.writeComment")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[44px] max-h-[120px] resize-none text-sm"
          rows={1}
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim() || disabled}
          size="sm"
          title={isMac ? `${t("common.send")} (\u2318\u21B5)` : `${t("common.send")} (Ctrl+Enter)`}
        >
          {sending ? "..." : <>{t("common.send")} <span className="ml-1 text-xs opacity-60">{isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}</span></>}
        </Button>
      </div>
    </div>
  );
}
