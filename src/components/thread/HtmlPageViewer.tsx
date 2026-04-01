"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface AnnotationAnchor {
  file_path: string;
  anchor_type: "line" | "selector";
  start_line?: number;
  end_line?: number;
  selector?: string;
  commit_hash: string;
  content_snapshot: string;
}

interface AnnotationMessage {
  id: string;
  annotation?: AnnotationAnchor;
}

export function HtmlPageViewer({
  threadId,
  filename,
  annotations = [],
  onCreateAnnotation,
  highlightAnnotationId,
  onPinClicked,
}: {
  threadId: string;
  filename: string;
  annotations?: AnnotationMessage[];
  onCreateAnnotation?: (selector: string, contentSnapshot: string, body: string) => void;
  highlightAnnotationId?: string | null;
  onPinClicked?: (annotationId: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; text: string } | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Build preview URL with injected bridge script
  const previewUrl = `/api/threads/${threadId}/preview?file=${encodeURIComponent(filename)}&inject=annotation-bridge`;

  // Listen for messages from iframe bridge
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || !data.type) return;

      switch (data.type) {
        case "bridge-ready":
          setBridgeReady(true);
          break;
        case "element-selected":
          setSelectedElement({ selector: data.selector, text: data.text });
          setCommentBody("");
          setTimeout(() => commentInputRef.current?.focus(), 50);
          break;
        case "pin-clicked":
          onPinClicked?.(data.annotationId);
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onPinClicked]);

  // Toggle annotate mode in iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "set-annotate-mode", enabled: annotateMode },
      "*"
    );
  }, [annotateMode]);

  // Show annotation pins in iframe when bridge is ready
  useEffect(() => {
    if (!bridgeReady) return;
    const selectorAnnotations = annotations
      .filter((m) => m.annotation?.anchor_type === "selector" && m.annotation?.selector)
      .map((m) => ({ id: m.id, selector: m.annotation!.selector }));

    iframeRef.current?.contentWindow?.postMessage(
      { type: "show-pins", annotations: selectorAnnotations },
      "*"
    );
  }, [bridgeReady, annotations]);

  // Highlight specific annotation
  useEffect(() => {
    if (!highlightAnnotationId || !bridgeReady) return;
    const msg = annotations.find((m) => m.id === highlightAnnotationId);
    const selector = msg?.annotation?.selector;
    if (selector) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "scroll-to", selector },
        "*"
      );
    }
  }, [highlightAnnotationId, bridgeReady, annotations]);

  const handleSubmit = useCallback(async () => {
    if (!commentBody.trim() || !selectedElement || !onCreateAnnotation) return;
    setSubmitting(true);
    try {
      await onCreateAnnotation(selectedElement.selector, selectedElement.text, commentBody.trim());
      setSelectedElement(null);
      setCommentBody("");
      setAnnotateMode(false);
    } finally {
      setSubmitting(false);
    }
  }, [commentBody, selectedElement, onCreateAnnotation]);

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Toolbar */}
      {onCreateAnnotation && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
          <button
            className={`text-xs px-2 py-1 rounded transition-colors ${
              annotateMode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => {
              setAnnotateMode(!annotateMode);
              if (annotateMode) setSelectedElement(null);
            }}
          >
            📌 {annotateMode ? "Annotating..." : "Annotate"}
          </button>
          {annotateMode && (
            <span className="text-xs text-muted-foreground">Click an element to comment</span>
          )}
        </div>
      )}

      {/* iframe */}
      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="w-full flex-1 border-0"
        sandbox="allow-scripts allow-same-origin"
        title={filename}
      />

      {/* Comment popover for selected element */}
      {selectedElement && onCreateAnnotation && (
        <div className="absolute bottom-4 right-4 z-40 w-80 bg-background border border-border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              📌 Annotate element
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedElement(null)}
            >
              ✕
            </button>
          </div>
          <div className="text-xs font-mono text-foreground/60 bg-muted rounded px-2 py-1">
            <div className="text-[10px] text-muted-foreground mb-0.5">{selectedElement.selector}</div>
            <div className="truncate">{selectedElement.text || "(empty element)"}</div>
          </div>
          <textarea
            ref={commentInputRef}
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder="Add your comment..."
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") setSelectedElement(null);
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              onClick={() => setSelectedElement(null)}
            >
              Cancel
            </button>
            <button
              className="text-xs bg-primary text-primary-foreground rounded px-3 py-1 hover:bg-primary/90 disabled:opacity-50"
              disabled={!commentBody.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "..." : "Comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
