"use client";

import { AuthProvider } from "@/components/layout/AuthProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { NavigationProvider, useNavigation } from "@/components/layout/NavigationContext";
import { ChannelPanel } from "@/components/layout/ChannelPanel";
import { ForYouPanel } from "@/components/layout/ForYouPanel";
import { I18nProvider } from "@/lib/i18n";

function MainContent({ children }: { children: React.ReactNode }) {
  const { activeView } = useNavigation();

  if (activeView === "channel") {
    return <ChannelPanel />;
  }

  if (activeView === "foryou") {
    return <ForYouPanel />;
  }

  // For other views (members, files, docs, settings), render route children
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <NavigationProvider>
          <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-hidden">
              <MainContent>{children}</MainContent>
            </main>
          </div>
        </NavigationProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
