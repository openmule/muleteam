"use client";

import { useState, useMemo } from "react";
import { MarkdownPageViewer } from "./MarkdownPageViewer";
import { HtmlPageViewer } from "./HtmlPageViewer";

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
  type: string;
  annotation?: AnnotationAnchor;
}

interface PageFile {
  name: string;
  size: number;
  modified: string;
}

export interface CreateAnnotationPayload {
  file_path: string;
  anchor_type: "line" | "selector";
  start_line?: number;
  end_line?: number;
  selector?: string;
  content_snapshot: string;
}

const RENDERABLE_RE = /\.(html|htm|md|mdx|markdown)$/i;
// System-generated workspace files that should NOT trigger page viewer
const EXCLUDED_FILES = new Set(["README.md", "DECISION_LOG.md"]);
const isHtml = (name: string) => /\.(html|htm)$/i.test(name);
const isMarkdown = (name: string) => /\.(md|mdx|markdown)$/i.test(name);

export function PageViewer({
  threadId,
  files,
  messages = [],
  onCreateAnnotation,
  highlightAnnotationId,
  onPinClicked,
}: {
  threadId: string;
  files: PageFile[];
  messages?: AnnotationMessage[];
  onCreateAnnotation?: (payload: CreateAnnotationPayload, body: string) => Promise<void>;
  highlightAnnotationId?: string | null;
  onPinClicked?: (annotationId: string) => void;
}) {
  const renderableFiles = files.filter((f) => RENDERABLE_RE.test(f.name) && !EXCLUDED_FILES.has(f.name));
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const current = activeFile && renderableFiles.some((f) => f.name === activeFile)
    ? activeFile
    : renderableFiles[0]?.name ?? null;

  const currentAnnotations = useMemo(
    () => messages.filter((m) => m.type === "annotation" && m.annotation?.file_path === current),
    [messages, current]
  );

  // Auto-switch to the file referenced by highlighted annotation
  const effectiveHighlight = useMemo(() => {
    if (!highlightAnnotationId) return null;
    const msg = messages.find(m => m.id === highlightAnnotationId);
    if (msg?.annotation?.file_path && msg.annotation.file_path !== current) {
      setActiveFile(msg.annotation.file_path);
    }
    return highlightAnnotationId;
  }, [highlightAnnotationId, messages, current]);

  if (renderableFiles.length === 0 || !current) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <div className="text-center space-y-1">
          <div className="text-2xl opacity-40">📄</div>
          <p>No renderable files</p>
          <p className="text-xs">Add .html, .md, or .mdx files to workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* File tabs */}
      {renderableFiles.length > 1 && (
        <div className="flex items-center gap-0 border-b border-border shrink-0 overflow-x-auto">
          {renderableFiles.map((f) => (
            <button
              key={f.name}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                f.name === current
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveFile(f.name)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Single file: show filename bar */}
      {renderableFiles.length === 1 && (
        <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
          <span className="text-xs font-mono text-muted-foreground">{current}</span>
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isHtml(current) ? (
          <HtmlPageViewer
            threadId={threadId}
            filename={current}
            annotations={currentAnnotations}
            onCreateAnnotation={
              onCreateAnnotation
                ? (selector, snapshot, body) =>
                    onCreateAnnotation(
                      { file_path: current, anchor_type: "selector", selector, content_snapshot: snapshot },
                      body
                    )
                : undefined
            }
            highlightAnnotationId={effectiveHighlight}
            onPinClicked={onPinClicked}
          />
        ) : isMarkdown(current) ? (
          <MarkdownPageViewer
            threadId={threadId}
            filename={current}
            annotations={currentAnnotations}
            onCreateAnnotation={
              onCreateAnnotation
                ? (line, snapshot, body) =>
                    onCreateAnnotation(
                      { file_path: current, anchor_type: "line", start_line: line, end_line: line, content_snapshot: snapshot },
                      body
                    )
                : undefined
            }
            highlightAnnotationId={effectiveHighlight}
          />
        ) : null}
      </div>
    </div>
  );
}

export { RENDERABLE_RE };
