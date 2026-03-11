"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { useT } from "@/lib/i18n";
import { FileViewer } from "@/components/thread/FileViewer";

interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileTreeNode[];
}

interface ThreadFileGroup {
  thread_id: string;
  thread_title: string;
  total_size: number;
  tree: FileTreeNode[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function FileTreeItem({
  node,
  depth,
  threadId,
  pathPrefix,
  onFileClick,
}: {
  node: FileTreeNode;
  depth: number;
  threadId: string;
  pathPrefix: string;
  onFileClick: (threadId: string, fullPath: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const paddingLeft = 16 + depth * 16;
  const fullPath = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;

  if (node.type === "directory") {
    return (
      <>
        <button
          className="flex items-center gap-2 w-full text-left py-1 text-sm hover:bg-muted/50 transition-colors"
          style={{ paddingLeft }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-xs text-muted-foreground">{expanded ? "\u25BE" : "\u25B8"}</span>
          <svg className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className="text-sm">{node.name}</span>
        </button>
        {expanded && node.children?.map((child, i) => (
          <FileTreeItem key={`${child.name}-${i}`} node={child} depth={depth + 1} threadId={threadId} pathPrefix={fullPath} onFileClick={onFileClick} />
        ))}
      </>
    );
  }

  const isImage = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(node.name);

  return (
    <button
      className="flex items-center gap-2 w-full text-left py-1 text-sm hover:bg-muted/50 transition-colors"
      style={{ paddingLeft }}
      onClick={() => onFileClick(threadId, fullPath)}
    >
      <span className="w-3" />
      {isImage ? (
        <svg className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      ) : (
        <svg className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      )}
      <span className="text-sm truncate">{node.name}</span>
      {node.size != null && (
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatSize(node.size)}</span>
      )}
    </button>
  );
}

export default function FilesPage() {
  const { loading: authLoading } = useAuth();
  const t = useT();
  const router = useRouter();
  const [groups, setGroups] = useState<ThreadFileGroup[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [maxStorage, setMaxStorage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [viewingFile, setViewingFile] = useState<{ threadId: string; filename: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
        setTotalSize(data.total_size ?? 0);
        setMaxStorage(data.max_storage_bytes ?? 0);
      }
      setLoading(false);
    }
    load();
  }, [authLoading]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const handleFileClick = (threadId: string, fullPath: string) => {
    setViewingFile({ threadId, filename: fullPath });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const usagePercent = maxStorage > 0 ? Math.min((totalSize / maxStorage) * 100, 100) : 0;
  const barColor = usagePercent > 95 ? "bg-red-500" : usagePercent > 80 ? "bg-orange-500" : "bg-green-500";

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-xl font-semibold tracking-tight mb-6">{t("files.title")}</h1>

      {/* Storage usage bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-muted-foreground">
            {maxStorage > 0
              ? t("files.storageUsed").replace("{used}", formatSize(totalSize)).replace("{limit}", formatSize(maxStorage))
              : t("files.storageUnlimited").replace("{used}", formatSize(totalSize))}
          </span>
        </div>
        {maxStorage > 0 && (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usagePercent}%` }} />
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground text-sm">{t("files.noFiles")}</p>
        </div>
      ) : (
        <div className="rounded-md border border-border divide-y divide-border">
          {groups.map((group) => {
            const isExpanded = expandedThreads.has(group.thread_id);
            const fileCount = (function countFiles(nodes: FileTreeNode[]): number {
              return nodes.reduce((sum, n) => sum + (n.type === "file" ? 1 : countFiles(n.children || [])), 0);
            })(group.tree);

            return (
              <div key={group.thread_id}>
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleThread(group.thread_id)}
                >
                  <span className="text-xs text-muted-foreground">{isExpanded ? "\u25BE" : "\u25B8"}</span>
                  <svg className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                  <span className="text-sm font-medium truncate flex-1">{group.thread_title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t("files.threadFiles").replace("{count}", String(fileCount))} &middot; {formatSize(group.total_size)}
                  </span>
                  <button
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title={group.thread_title}
                    onClick={(e) => { e.stopPropagation(); router.push(`/thread/${group.thread_id}`); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                </div>
                {isExpanded && (
                  <div className="border-t border-border pb-1">
                    {group.tree.map((node, i) => (
                      <FileTreeItem
                        key={`${node.name}-${i}`}
                        node={node}
                        depth={0}
                        threadId={group.thread_id}
                        pathPrefix=""
                        onFileClick={handleFileClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewingFile && (
        <FileViewer
          threadId={viewingFile.threadId}
          filename={viewingFile.filename}
          onClose={() => setViewingFile(null)}
        />
      )}
    </main>
  );
}
