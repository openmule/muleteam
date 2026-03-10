"use client";

import { AuthProvider } from "@/components/layout/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Navbar />
        {children}
      </div>
    </AuthProvider>
  );
}
