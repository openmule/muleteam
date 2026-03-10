"use client";

import { AuthProvider } from "@/components/layout/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { I18nProvider } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Navbar />
          {children}
        </div>
      </AuthProvider>
    </I18nProvider>
  );
}
