"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface NavigationState {
  activeChannelId: string | null;
  activeThreadId: string | null;
  activeView: "foryou" | "channel" | "members" | "files" | "docs" | "settings";
  setChannel: (channelId: string) => void;
  setThread: (threadId: string) => void;
  setView: (view: NavigationState["activeView"]) => void;
}

const NavigationContext = createContext<NavigationState>({
  activeChannelId: null,
  activeThreadId: null,
  activeView: "foryou",
  setChannel: () => {},
  setThread: () => {},
  setView: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavigationState["activeView"]>("foryou");

  const setChannel = useCallback((channelId: string) => {
    if (channelId === activeChannelId) return;
    setActiveChannelId(channelId);
    // Don't clear activeThreadId here — ChannelPanel will set it after fetching threads
    setActiveView("channel");
  }, [activeChannelId]);

  const setThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    // Update browser URL to reflect the active thread (enables link sharing, back/forward, debugging)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/thread/${threadId}`);
    }
  }, []);

  const setView = useCallback((view: NavigationState["activeView"]) => {
    setActiveView(view);
    if (view !== "channel") {
      setActiveChannelId(null);
      setActiveThreadId(null);
    }
  }, []);

  return (
    <NavigationContext.Provider value={{ activeChannelId, activeThreadId, activeView, setChannel, setThread, setView }}>
      {children}
    </NavigationContext.Provider>
  );
}
