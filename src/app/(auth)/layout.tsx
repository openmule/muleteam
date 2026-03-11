"use client";

import { I18nProvider } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
    </I18nProvider>
  );
}
