"use client";

import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { useT } from "@/lib/i18n";

const COLLAPSE_THRESHOLD = 600; // characters

/** Highlight @mentions in text nodes — supports @name and @[Name With Spaces] */
function processTextWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match @[Name With Spaces] or @single-word
  const regex = /@\[([^\]]+)\]|@([\w-]+)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const name = match[1] ?? match[2]; // [1] = bracketed, [2] = single word
    parts.push(
      <span
        key={`mention-${key++}`}
        className="inline-flex items-center rounded px-1 py-0.5 text-xs font-medium bg-primary/10 text-primary"
      >
        @{name}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MarkdownBody({ body }: { body: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > COLLAPSE_THRESHOLD;
  const displayBody = isLong && !expanded ? body.slice(0, COLLAPSE_THRESHOLD) : body;

  const components = useMemo(
    () => ({
      // Override text rendering in paragraphs to highlight @mentions
      p: ({ children, ...props }: React.ComponentProps<"p">) => (
        <p {...props}>
          {Array.isArray(children)
            ? children.map((child, i) =>
                typeof child === "string" ? (
                  <span key={i}>{processTextWithMentions(child)}</span>
                ) : (
                  child
                )
              )
            : typeof children === "string"
              ? processTextWithMentions(children)
              : children}
        </p>
      ),
      // Override li to also handle mentions
      li: ({ children, ...props }: React.ComponentProps<"li">) => (
        <li {...props}>
          {Array.isArray(children)
            ? children.map((child, i) =>
                typeof child === "string" ? (
                  <span key={i}>{processTextWithMentions(child)}</span>
                ) : (
                  child
                )
              )
            : typeof children === "string"
              ? processTextWithMentions(children)
              : children}
        </li>
      ),
      // Code blocks: rehype-highlight handles syntax highlighting
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
        if (isBlock) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        // Inline code
        return (
          <code
            className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      },
      // Links open in new tab
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
      // Tables
      table: ({ children, ...props }: React.ComponentProps<"table">) => (
        <div className="overflow-x-auto my-2">
          <table className="text-xs border-collapse w-full" {...props}>
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
      // Block quotes
      blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
        <blockquote
          className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground"
          {...props}
        >
          {children}
        </blockquote>
      ),
    }),
    []
  );

  return (
    <div className="text-[length:var(--font-size-body-base)] text-foreground/90 max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mt-3 [&>h1]:mb-1.5 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1.5 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mt-2 [&>h3]:mb-1 [&>hr]:my-3 [&>hr]:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {displayBody}
      </ReactMarkdown>
      {isLong && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-muted-foreground hover:text-foreground mt-1 underline underline-offset-2"
        >
          {t("thread.showMore")}
        </button>
      )}
      {isLong && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground mt-1 underline underline-offset-2"
        >
          {t("thread.showLess")}
        </button>
      )}
    </div>
  );
}
