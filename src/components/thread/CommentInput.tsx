"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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
  threadId,
  onSubmit,
  disabled,
  replyTo,
  onCancelReply,
}: {
  threadId: string;
  onSubmit: (body: string, replyTo?: string) => Promise<void>;
  disabled?: boolean;
  replyTo?: ReplyContext | null;
  onCancelReply?: () => void;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMac = useIsMac();

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  // Generate preview URLs for pending images
  useEffect(() => {
    const urls = pendingImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingImages]);

  const validateAndAddImages = useCallback(
    (files: File[]) => {
      setImageError(null);

      const imageFiles = files.filter((f) => ALLOWED_TYPES.includes(f.type));
      if (imageFiles.length === 0 && files.length > 0) {
        setImageError(t("thread.unsupportedFormat"));
        return;
      }

      const oversized = imageFiles.find((f) => f.size > MAX_IMAGE_SIZE);
      if (oversized) {
        setImageError(t("thread.imageTooLarge").replace("{size}", "5MB"));
        return;
      }

      setPendingImages((prev) => {
        const combined = [...prev, ...imageFiles];
        if (combined.length > MAX_IMAGES) {
          setImageError(t("thread.maxImages").replace("{count}", String(MAX_IMAGES)));
          return prev;
        }
        return combined;
      });
    },
    [t]
  );

  const removeImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
    setImageError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      validateAndAddImages(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && ALLOWED_TYPES.includes(item.type)) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      validateAndAddImages(imageFiles);
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    if (pendingImages.length === 0) return [];

    const formData = new FormData();
    for (const img of pendingImages) {
      formData.append("images", img);
    }

    const res = await fetch(`/api/threads/${threadId}/images`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to upload images");
    }

    const data = await res.json();
    return data.paths as string[];
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || sending) return;
    setSending(true);
    setImageError(null);
    try {
      // Upload images first if any
      const imagePaths = await uploadImages();

      // Build message body: text + image references
      let body = input.trim();
      if (imagePaths.length > 0) {
        const imageMarkdown = imagePaths
          .map((p) => `![image](${p})`)
          .join("\n");
        body = body ? `${body}\n\n${imageMarkdown}` : imageMarkdown;
      }

      await onSubmit(body, replyTo?.id);
      setInput("");
      setPendingImages([]);
      onCancelReply?.();
      // Blur textarea to dismiss mobile keyboard, then reset scroll
      // so the navbar doesn't get pushed off-screen
      textareaRef.current?.blur();
      requestAnimationFrame(() => window.scrollTo(0, 0));
    } catch (err) {
      setImageError(String(err instanceof Error ? err.message : err));
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

  const hasContent = input.trim() || pendingImages.length > 0;

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

      {/* Image preview strip */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {previewUrls.map((url, i) => (
            <div key={i} className="relative group/img">
              <img
                src={url}
                alt={`Preview ${i + 1}`}
                className="w-16 h-16 object-cover rounded-md border border-border"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {imageError && (
        <div className="text-xs text-destructive mb-2">{imageError}</div>
      )}

      <div className="flex gap-2">
        {/* Paperclip button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || pendingImages.length >= MAX_IMAGES}
          className="self-end p-2 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors shrink-0"
          title={t("thread.attachImage")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <Textarea
          ref={textareaRef}
          placeholder={replyTo ? t("thread.replyToPlaceholder").replace("{name}", replyTo.from_name) : t("thread.writeComment")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-h-[44px] max-h-[120px] resize-none text-sm"
          rows={1}
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={sending || !hasContent || disabled}
          size="sm"
          title={isMac ? `${t("common.send")} (\u2318\u21B5)` : `${t("common.send")} (Ctrl+Enter)`}
        >
          {sending ? "..." : <>{t("common.send")} <span className="ml-1 text-xs opacity-60">{isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}</span></>}
        </Button>
      </div>
    </div>
  );
}
