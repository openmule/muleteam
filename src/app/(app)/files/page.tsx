"use client";

import { useAuth } from "@/components/layout/AuthProvider";

export default function FilesPage() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight mb-6">Files</h1>
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
        <p className="text-muted-foreground text-sm">
          File management is coming soon.
        </p>
      </div>
    </main>
  );
}
