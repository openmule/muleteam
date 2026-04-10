"use client";

import { useEffect, useState, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

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

/** Rehype plugin: inject data-source-line on top-level block elements only.
 *  Only direct children of the root get tagged — nested elements (li, td,
 *  strong, etc.) are skipped to avoid overlapping/out-of-order gutter entries. */
function rehypeLineNumbers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    if (!Array.isArray(tree.children)) return;
    for (const node of tree.children) {
      if (node.type === "element" && node.position?.start?.line) {
        node.properties = node.properties || {};
        node.properties["dataSourceLine"] = node.position.start.line;
      }
    }
  };
}

interface LinePosition {
  line: number;
  top: number;
  height: number;
}

export function MarkdownPageViewer({
  threadId,
  filename,
  annotations = [],
  onCreateAnnotation,
  onPinClicked,
  highlightAnnotationId,
}: {
  threadId: string;
  filename: string;
  annotations?: AnnotationMessage[];
  onCreateAnnotation?: (line: number, contentSnapshot: string, body: string) => void;
  onPinClicked?: (annotationId: string) => void;
  highlightAnnotationId?: string | null;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [linePositions, setLinePositions] = useState<LinePosition[]>([]);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setContent(null);
    fetch(`/api/threads/${threadId}/workspace/${encodeURIComponent(filename)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setContent(data?.content ?? null))
      .finally(() => setLoading(false));
  }, [threadId, filename]);

  const sourceLines = useMemo(() => content?.split("\n") ?? [], [content]);

  // Build set of lines that have annotations
  const annotatedLines = useMemo(() => {
    const lines = new Map<number, string[]>(); // line → [messageIds]
    for (const msg of annotations) {
      const ann = msg.annotation;
      if (!ann || ann.anchor_type !== "line" || ann.file_path !== filename) continue;
      const start = ann.start_line ?? 0;
      const end = ann.end_line ?? start;
      for (let l = start; l <= end; l++) {
        if (!lines.has(l)) lines.set(l, []);
        lines.get(l)!.push(msg.id);
      }
    }
    return lines;
  }, [annotations, filename]);

  // Measure positions of rendered block elements after content renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!contentRef.current || !containerRef.current) return;

    const els = contentRef.current.querySelectorAll("[data-source-line]");
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const seen = new Set<number>();
    const positions: LinePosition[] = [];

    els.forEach((el) => {
      const line = parseInt(el.getAttribute("data-source-line") || "0");
      if (line <= 0 || seen.has(line)) return;
      seen.add(line);
      const rect = el.getBoundingClientRect();
      positions.push({
        line,
        top: rect.top - containerRect.top + scrollTop,
        height: rect.height,
      });
    });

    positions.sort((a, b) => a.line - b.line);
    setLinePositions(positions);
  // Re-measure when content changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, renderKey]);

  // Trigger re-measure after ReactMarkdown finishes rendering
  useEffect(() => {
    if (content !== null) {
      const timer = setTimeout(() => setRenderKey((k) => k + 1), 100);
      return () => clearTimeout(timer);
    }
  }, [content]);

  // Handle line click
  const handleLineClick = useCallback(
    (lineNum: number) => {
      const msgIds = annotatedLines.get(lineNum);
      if (msgIds && msgIds.length > 0 && onPinClicked) {
        // Has existing annotations → navigate to first one in chat
        onPinClicked(msgIds[0]);
        return;
      }
      if (!onCreateAnnotation) return;
      setCommentLine(lineNum);
      setCommentBody("");
      setTimeout(() => commentInputRef.current?.focus(), 50);
    },
    [onCreateAnnotation, onPinClicked, annotatedLines]
  );

  // Submit annotation
  const handleSubmit = useCallback(async () => {
    if (!commentBody.trim() || commentLine === null || !onCreateAnnotation) return;
    setSubmitting(true);
    try {
      const snapshot = sourceLines[commentLine - 1] ?? "";
      await onCreateAnnotation(commentLine, snapshot, commentBody.trim());
      setCommentLine(null);
      setCommentBody("");
    } finally {
      setSubmitting(false);
    }
  }, [commentBody, commentLine, sourceLines, onCreateAnnotation]);

  // Scroll to highlighted annotation line (waits for content to render)
  useEffect(() => {
    if (!highlightAnnotationId || !contentRef.current || !content) return;
    const msg = annotations.find((m) => m.id === highlightAnnotationId);
    const ann = msg?.annotation;
    if (!ann || ann.anchor_type !== "line" || !ann.start_line) return;

    // Delay to ensure DOM is fully rendered after content load
    const timer = setTimeout(() => {
      if (!contentRef.current) return;
      const lineEl = contentRef.current.querySelector(
        `[data-source-line="${ann.start_line}"]`
      ) as HTMLElement | null;
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
        lineEl.classList.add("bg-yellow-200/50", "dark:bg-yellow-900/30");
        setTimeout(() => {
          lineEl.classList.remove("bg-yellow-200/50", "dark:bg-yellow-900/30");
        }, 2000);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightAnnotationId, annotations, content, renderKey]);

  const components = useMemo(
    () => ({
      pre: ({ children, ...props }: React.ComponentProps<"pre">) => (
        <pre
          className="rounded-md bg-muted p-3 overflow-x-auto text-xs leading-relaxed my-2"
          {...props}
        >
          {children}
        </pre>
      ),
      code: ({
        className,
        children,
        ...props
      }: React.ComponentProps<"code"> & { className?: string }) => {
        const isBlock = className?.startsWith("hljs") || className?.startsWith("language-");
        if (isBlock)
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        return (
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" {...props}>
            {children}
          </code>
        );
      },
      a: ({ children, ...props }: React.ComponentProps<"a">) => (
        <a
          className="underline underline-offset-2 text-primary hover:text-primary/80"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      ),
      table: ({ children, ...props }: React.ComponentProps<"table">) => (
        <div className="overflow-x-auto my-2">
          <table className="text-sm border-collapse w-full" {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ children, ...props }: React.ComponentProps<"th">) => (
        <th className="border border-border px-2 py-1 text-left font-medium bg-muted" {...props}>
          {children}
        </th>
      ),
      td: ({ children, ...props }: React.ComponentProps<"td">) => (
        <td className="border border-border px-2 py-1" {...props}>
          {children}
        </td>
      ),
      blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
        <blockquote
          className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground"
          {...props}
        >
          {children}
        </blockquote>
      ),
      img: ({ ...props }: React.ComponentProps<"img">) => (
        <img className="max-w-full h-auto rounded my-2" {...props} />
      ),
    }),
    []
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Failed to load file</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 relative" ref={containerRef}>
      {/* Position-based line number gutter */}
      <div className="absolute left-0 top-0 w-10 select-none z-10 border-r border-border bg-muted/30">
        {linePositions.map(({ line, top, height }) => {
          const hasAnnotation = annotatedLines.has(line);
          return (
            <div
              key={line}
              className={`absolute right-0 pr-2 font-mono text-xs text-right w-10 flex items-center justify-end cursor-pointer transition-colors ${
                hasAnnotation
                  ? "text-primary font-medium"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              } ${commentLine === line ? "bg-primary/10 text-primary" : ""}`}
              style={{ top, height }}
              onClick={() => handleLineClick(line)}
              title={
                hasAnnotation
                  ? `${annotatedLines.get(line)!.length} annotation(s) — click to view`
                  : "Click to annotate"
              }
            >
              {hasAnnotation ? "📌" : line}
            </div>
          );
        })}
      </div>

      {/* Rendered content */}
      <div className="pl-12 pr-6 py-4 relative" ref={contentRef}>
        <div className="prose-sm max-w-none text-foreground/90 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mt-6 [&>h1]:mb-3 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-medium [&>h3]:mt-4 [&>h3]:mb-2 [&>hr]:my-4 [&>hr]:border-border">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeLineNumbers]}
            components={components}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Inline comment popover */}
        {commentLine !== null && onCreateAnnotation && (
          <div className="fixed bottom-4 right-4 z-[60] w-80 bg-background border border-border rounded-lg shadow-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                📌 Annotate line {commentLine}
              </span>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCommentLine(null)}
              >
                ✕
              </button>
            </div>
            <div className="text-xs font-mono text-foreground/60 bg-muted rounded px-2 py-1 truncate">
              {sourceLines[commentLine - 1] || "(empty line)"}
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
                if (e.key === "Escape") {
                  setCommentLine(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                onClick={() => setCommentLine(null)}
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
    </div>
  );
}
