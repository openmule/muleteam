"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useNavigation } from "./NavigationContext";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/use-theme";
import { memberUrl } from "@/components/shared/helpers";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { NewThreadDialog } from "@/components/shared/NewThreadDialog";
import { CreateChannelForm } from "@/components/shared/CreateChannelForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Search, CirclePlus, User, Moon, Languages, LogOut, Settings,
  AtSign, Wand, Pizza, PencilRuler, Briefcase, Newspaper,
  Users, Box, BookText, Hash, UserPlus, Bot, MessageCircle,
  Code, Palette, Megaphone, Shield, Zap, Globe, Heart,
  Camera, Music, Gamepad2, BookOpen, FlaskConical, Truck,
  Building2, GraduationCap, Stethoscope, Scale, Wrench,
  Rocket, Target, BarChart3, MessageSquare, Lightbulb,
} from "lucide-react";
import type { RegisteredAgent, ChannelMeta, User as UserType } from "@/components/shared/types";

/** Keywords → icon mapping for auto-detection */
const ICON_KEYWORDS: [string[], React.ComponentType<{ className?: string; strokeWidth?: number }>][] = [
  [["engineer", "dev", "code", "tech", "backend", "frontend", "fullstack"], Code],
  [["design", "ui", "ux", "visual", "graphic"], PencilRuler],
  [["product", "pm", "roadmap", "feature"], Briefcase],
  [["general", "all", "team", "everyone", "misc"], Wand],
  [["ops", "infra", "devops", "deploy", "monitor", "sre"], Wrench],
  [["marketing", "growth", "campaign", "brand"], Megaphone],
  [["security", "auth", "compliance", "audit"], Shield],
  [["data", "analytics", "metric", "insight", "bi"], BarChart3],
  [["research", "explore", "discovery", "lab"], FlaskConical],
  [["support", "help", "service", "customer"], Heart],
  [["sales", "deal", "revenue", "crm"], Target],
  [["finance", "billing", "payment", "budget"], Scale],
  [["hr", "people", "culture", "recruit", "hiring"], Users],
  [["education", "learn", "train", "onboard"], GraduationCap],
  [["health", "medical", "wellness"], Stethoscope],
  [["media", "content", "blog", "video", "photo"], Camera],
  [["music", "audio", "sound"], Music],
  [["game", "gaming", "play"], Gamepad2],
  [["doc", "wiki", "knowledge", "docs"], BookOpen],
  [["ship", "logistics", "supply"], Truck],
  [["office", "workplace", "facility"], Building2],
  [["launch", "release", "ship"], Rocket],
  [["chat", "discuss", "talk", "forum"], MessageSquare],
  [["idea", "brainstorm", "innovation"], Lightbulb],
  [["global", "international", "i18n", "locale"], Globe],
  [["api", "integration", "webhook", "connect"], Zap],
  [["news", "update", "announce"], Newspaper],
  [["art", "creative", "style"], Palette],
];

/** Color pool for auto-assignment */
const COLOR_POOL = [
  "text-[var(--color-purple-1000)]",
  "text-[var(--color-blue-1000)]",
  "text-[var(--color-pink-1000)]",
  "text-[var(--color-orange-1000)]",
  "text-[var(--color-cyan-1000)]",
  "text-[var(--color-green-1000)]",
  "text-[var(--color-red-1000)]",
  "text-[var(--color-indigo-1000)]",
  "text-[var(--color-brown-1000)]",
  "text-[var(--color-teal-1000)]",
];

/** Deterministic hash for consistent color assignment */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Auto-detect icon and color from channel name/id */
function getChannelConfig(channelId: string, channelName: string): { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>, color: string } {
  // Check hardcoded overrides first
  if (CHANNEL_CONFIG_OVERRIDES[channelId]) return CHANNEL_CONFIG_OVERRIDES[channelId];

  // Auto-detect icon from name keywords
  const nameLower = (channelId + " " + channelName).toLowerCase();
  let icon: React.ComponentType<{ className?: string; strokeWidth?: number }> = Hash;
  for (const [keywords, candidateIcon] of ICON_KEYWORDS) {
    if (keywords.some(kw => nameLower.includes(kw))) {
      icon = candidateIcon;
      break;
    }
  }

  // Deterministic color from channel id
  const color = COLOR_POOL[hashString(channelId) % COLOR_POOL.length];

  return { icon, color };
}

/** Hardcoded overrides for known channels (from Figma design) */
const CHANNEL_CONFIG_OVERRIDES: Record<string, { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>, color: string }> = {
  general: { icon: Wand, color: "text-[var(--color-purple-1000)]" },
  engineering: { icon: Pizza, color: "text-[var(--color-blue-1000)]" },
  design: { icon: PencilRuler, color: "text-[var(--color-pink-1000)]" },
  product: { icon: Briefcase, color: "text-[var(--color-orange-1000)]" },
  ops: { icon: Newspaper, color: "text-[var(--color-orange-1000)]" },
};

/** Public accessor — used by ChannelPanel and other components */
export const CHANNEL_CONFIG = new Proxy({} as Record<string, { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>, color: string }>, {
  get: (_, channelId: string) => getChannelConfig(channelId, channelId),
});

const BOTTOM_NAV = [
  { href: "/members", labelKey: "nav.members", icon: Users },
  { href: "/files", labelKey: "nav.files", icon: Box },
  { href: "/docs", labelKey: "nav.docs", icon: BookText },
] as const;

/** Icon size style: 16px with 1.25px stroke (scaled from 24px base) */
const ICON_STYLE = "size-4 shrink-0";
/** Icon stroke width: 1.25px in 24px viewBox */
const ICON_STROKE = 1.5;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { activeChannelId, activeView, setChannel: navSetChannel, setView } = useNavigation();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createThreadOpen, setCreateThreadOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [agentsRes, channelsRes, usersRes] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/channels"),
      fetch("/api/users"),
    ]);
    if (agentsRes.ok) setAgents((await agentsRes.json()).agents ?? []);
    if (channelsRes.ok) setChannels((await channelsRes.json()).channels ?? []);
    if (usersRes.ok) setAllUsers((await usersRes.json()).users ?? []);
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  if (!user) return null;

  const isForYouActive = activeView === "foryou";

  return (
    <aside className="flex flex-col w-[200px] shrink-0 h-screen bg-[var(--bg-grouped-primary)]">
      {/* ── TopBar ── */}
      <div className="flex items-center justify-between pt-4 pb-4 px-4 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
            <MemberAvatar type="human" name={user.name} size={32} avatarUrl={user.avatar_url} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="w-[220px]">
            <div className="flex flex-col gap-0.5 px-4 py-2.5">
              <span className="text-sm font-semibold truncate">{user.name}</span>
              <span className="text-xs text-[var(--label-secondary)] truncate">{user.email}</span>
            </div>
            <DropdownMenuSeparator className="mx-2" />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => { setView("members"); router.push(memberUrl(`human:${user.id}`)); }}>
                <User className="h-4 w-4" strokeWidth={1.5} /> {t("nav.myProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setView("settings"); router.push("/settings"); }}>
                <Settings className="h-4 w-4" strokeWidth={1.5} /> {t("nav.settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Moon className="h-4 w-4" strokeWidth={1.5} /> {t("nav.toggleDarkMode")}
                <Switch size="md" className="ml-auto" checked={isDark} onCheckedChange={(on) => setTheme(on ? "dark" : "light")} />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setLocale(locale === "zh" ? "en" : "zh"); }}>
                <Languages className="h-4 w-4" strokeWidth={1.5} />
                {locale === "zh" ? "English" : "中文"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="mx-2" />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-[var(--color-red-100)]">
              <LogOut className="h-4 w-4" strokeWidth={1.5} /> {t("nav.logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex gap-2 items-center">
          <button className="flex items-center justify-center size-8 rounded-[6px] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)] transition-all cursor-pointer">
            <Search className="size-5 shrink-0" strokeWidth={ICON_STROKE} />
          </button>
          <DropdownMenu open={plusMenuOpen} onOpenChange={setPlusMenuOpen}>
            <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-[6px] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)] transition-all focus:outline-none cursor-pointer">
              <CirclePlus
                className="size-5 shrink-0 transition-transform duration-300"
                strokeWidth={ICON_STROKE}
                style={{
                  transform: plusMenuOpen ? "rotate(135deg)" : "rotate(0deg)",
                  transitionTimingFunction: plusMenuOpen ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : "ease-out",
                }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" alignOffset={-24} sideOffset={4} className="w-[360px] p-2 rounded-[16px]">
              {/* Thread & Channel */}
              <div className="flex flex-col">
                <button
                  onClick={() => setCreateThreadOpen(true)}
                  className="flex gap-3 items-center p-3 h-16 rounded-[8px] hover:bg-[var(--fill-tertiary)] transition-colors cursor-pointer text-left"
                >
                  <div className="size-10 shrink-0 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center">
                    <MessageCircle className="size-5 text-[var(--label-primary)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[var(--label-primary)]">New Thread</span>
                    <span className="text-xs text-[var(--label-secondary)]">Start a conversation around a topic</span>
                  </div>
                </button>
                <button
                  onClick={() => setCreateChannelOpen(true)}
                  className="flex gap-3 items-center p-3 h-16 rounded-[8px] hover:bg-[var(--fill-tertiary)] transition-colors cursor-pointer text-left"
                >
                  <div className="size-10 shrink-0 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center">
                    <Hash className="size-5 text-[var(--label-primary)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[var(--label-primary)]">Create Channel</span>
                    <span className="text-xs text-[var(--label-secondary)]">Organize threads and members by team</span>
                  </div>
                </button>
              </div>
              {/* Divider */}
              <div className="mx-4 my-2 h-px bg-[var(--border-color-secondary)]" />
              {/* People & Agents */}
              <div className="flex flex-col">
                <button
                  onClick={() => router.push("/members")}
                  className="flex gap-3 items-center p-3 h-16 rounded-[8px] hover:bg-[var(--fill-tertiary)] transition-colors cursor-pointer text-left"
                >
                  <div className="size-10 shrink-0 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center">
                    <UserPlus className="size-5 text-[var(--label-primary)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[var(--label-primary)]">Invite People</span>
                    <span className="text-xs text-[var(--label-secondary)]">Bring teammates in with an invite link</span>
                  </div>
                </button>
                <button
                  onClick={() => router.push("/members")}
                  className="flex gap-3 items-center p-3 h-16 rounded-[8px] hover:bg-[var(--fill-tertiary)] transition-colors cursor-pointer text-left"
                >
                  <div className="size-10 shrink-0 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center">
                    <Bot className="size-5 text-[var(--label-primary)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[var(--label-primary)]">Hire Agent</span>
                    <span className="text-xs text-[var(--label-secondary)]">Add an AI agent to collaborate with your team</span>
                  </div>
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Main nav area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* For You */}
        <div className="px-2 shrink-0">
          <button
            onClick={() => { setView("foryou"); router.push("/"); }}
            className={`flex items-center gap-2 w-full h-11 px-3 rounded-[8px] text-sm transition-colors cursor-pointer ${
              isForYouActive
                ? "bg-[var(--fill-quaternary)] text-[var(--label-primary)] font-semibold"
                : "text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)]"
            }`}
          >
            <AtSign className={ICON_STYLE} strokeWidth={ICON_STROKE} />
            For You
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 my-4 h-px bg-[var(--border-color-secondary)]" />

        {/* Channels list — 2px gap between items with 1px hover ownership per side */}
        <div className="flex-1 overflow-y-auto px-2">
          {channels.map((channel) => {
            const config = getChannelConfig(channel.id, channel.name);
            const Icon = config.icon;
            const isActive = activeView === "channel" && activeChannelId === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => navSetChannel(channel.id)}
                className={`flex items-center gap-2 w-full h-11 px-3 my-px rounded-[8px] text-sm transition-colors cursor-pointer ${
                  isActive
                    ? `bg-[var(--fill-quaternary)] font-semibold ${config.color}`
                    : "text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)]"
                }`}
              >
                <Icon className={`${ICON_STYLE} ${isActive ? "" : config.color}`} strokeWidth={ICON_STROKE} />
                <span className="truncate">{channel.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom nav — 2px gap between items ── */}
      <div className="shrink-0 p-2">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const viewKey = item.href.slice(1) as "members" | "files" | "docs";
          const isActive = activeView === viewKey;
          return (
            <button
              key={item.href}
              onClick={() => { setView(viewKey); router.push(item.href); }}
              className={`flex items-center gap-2 w-full h-11 px-3 my-px rounded-[8px] text-sm transition-colors cursor-pointer ${
                isActive
                  ? "bg-[var(--fill-quaternary)] text-[var(--label-primary)] font-semibold"
                  : "text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)]"
              }`}
            >
              <Icon className={`${ICON_STYLE} text-[var(--label-primary)]`} strokeWidth={ICON_STROKE} />
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("channels.createChannel")}</DialogTitle>
          </DialogHeader>
          <CreateChannelForm
            agents={agents}
            users={allUsers}
            currentUserId={user.id}
            onSuccess={() => { setCreateChannelOpen(false); fetchData(); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={createThreadOpen} onOpenChange={setCreateThreadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("thread.newThreadTitle")}</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <NewThreadDialog
              agents={agents}
              users={allUsers}
              channels={channels}
              onCreated={() => { setCreateThreadOpen(false); fetchData(); }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

/** Export channel config for reuse in channel detail pages */
export { ICON_STROKE };

/** Badge color mapping: text-[var(--color-X-1000)] → { bg: bg-[var(--color-X-100)], text: text-[var(--color-X-1000)] } */
const COLOR_TO_BADGE: Record<string, { bg: string; text: string }> = {
  "text-[var(--color-purple-1000)]": { bg: "bg-[var(--color-purple-100)]", text: "text-[var(--color-purple-1000)]" },
  "text-[var(--color-blue-1000)]": { bg: "bg-[var(--color-blue-100)]", text: "text-[var(--color-blue-1000)]" },
  "text-[var(--color-pink-1000)]": { bg: "bg-[var(--color-pink-100)]", text: "text-[var(--color-pink-1000)]" },
  "text-[var(--color-orange-1000)]": { bg: "bg-[var(--color-orange-100)]", text: "text-[var(--color-orange-1000)]" },
  "text-[var(--color-cyan-1000)]": { bg: "bg-[var(--color-cyan-100)]", text: "text-[var(--color-cyan-1000)]" },
  "text-[var(--color-green-1000)]": { bg: "bg-[var(--color-green-100)]", text: "text-[var(--color-green-1000)]" },
  "text-[var(--color-red-1000)]": { bg: "bg-[var(--color-red-100)]", text: "text-[var(--color-red-1000)]" },
  "text-[var(--color-indigo-1000)]": { bg: "bg-[var(--color-indigo-100)]", text: "text-[var(--color-indigo-1000)]" },
  "text-[var(--color-brown-1000)]": { bg: "bg-[var(--color-brown-100)]", text: "text-[var(--color-brown-1000)]" },
  "text-[var(--color-teal-1000)]": { bg: "bg-[var(--color-teal-100)]", text: "text-[var(--color-teal-1000)]" },
};
export const DEFAULT_BADGE_COLOR = { bg: "bg-[var(--fill-quaternary)]", text: "text-[var(--label-secondary)]" };

/** Get badge colors for a channel — auto-derived from channel icon color */
export function getChannelBadgeColor(channelId: string): { bg: string; text: string } {
  const config = getChannelConfig(channelId, channelId);
  return COLOR_TO_BADGE[config.color] ?? DEFAULT_BADGE_COLOR;
}
