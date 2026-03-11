import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { listThreads, listWorkspaceFiles } from "@/lib/git-storage";

export interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileTreeNode[];
}

export interface ThreadFileGroup {
  thread_id: string;
  thread_title: string;
  total_size: number;
  updated_at: string;
  tree: FileTreeNode[];
}

function buildTree(files: { name: string; size: number; modified: string }[]): FileTreeNode[] {
  const root: FileTreeNode = { name: "", type: "directory", children: [] };

  for (const file of files) {
    const parts = file.name.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        current.children!.push({ name: part, type: "file", size: file.size, modified: file.modified });
      } else {
        let dir = current.children!.find((c) => c.name === part && c.type === "directory");
        if (!dir) {
          dir = { name: part, type: "directory", children: [] };
          current.children!.push(dir);
        }
        current = dir;
      }
    }
  }

  return root.children!;
}

// GET - list all files across all threads, grouped by thread
export async function GET(request: Request) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threads = listThreads();
  const groups: ThreadFileGroup[] = [];
  let totalSize = 0;

  for (const thread of threads) {
    const files = listWorkspaceFiles(thread.id);
    if (files.length === 0) continue;

    const threadSize = files.reduce((sum, f) => sum + f.size, 0);
    totalSize += threadSize;

    groups.push({
      thread_id: thread.id,
      thread_title: thread.title,
      total_size: threadSize,
      updated_at: thread.updated_at,
      tree: buildTree(files),
    });
  }

  // Sort by most recently updated thread first
  groups.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const maxStorageMb = parseInt(process.env.MAX_STORAGE_MB || "0", 10) || 0; // 0 = unlimited

  return NextResponse.json({
    groups,
    total_size: totalSize,
    max_storage_bytes: maxStorageMb > 0 ? maxStorageMb * 1024 * 1024 : 0,
  });
}
