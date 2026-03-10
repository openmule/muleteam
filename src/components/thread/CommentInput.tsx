"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (e.key === "Enter" && !e.shiftKey) {
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
          <span>Replying to <span className="font-medium text-foreground">{replyTo.from_name}</span></span>
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
          placeholder={replyTo ? `Reply to ${replyTo.from_name}...` : "Write a comment..."}
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
        >
          {sending ? "..." : "Comment"}
        </Button>
      </div>
    </div>
  );
}
