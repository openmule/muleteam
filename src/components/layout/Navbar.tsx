"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { memberUrl } from "@/components/shared/helpers";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { useI18n, LOCALES } from "@/lib/i18n";
import { useTheme } from "@/lib/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationBadge, NotificationDot } from "@/components/ui/badge";
import { User, Moon, Languages, Check, LogOut } from "lucide-react";

const NAV_KEYS = [
  { href: "/", labelKey: "nav.home" },
  { href: "/channels", labelKey: "nav.channels" },
  { href: "/members", labelKey: "nav.members" },
  { href: "/files", labelKey: "nav.files" },
  { href: "/docs", labelKey: "nav.docs" },
  { href: "/settings", labelKey: "nav.settings" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [teamInfo, setTeamInfo] = useState<{ slug: string; teamsUrl: string } | null>(null);

  // Detect platform subdomain (e.g. test-team.themule.team)
  // Only active when NEXT_PUBLIC_PLATFORM_MODE=true (set by muleteam-ai platform)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PLATFORM_MODE !== "true") return;
    const { hostname, protocol, port } = window.location;
    const parts = hostname.split(".");
    if (parts.length >= 3) {
      const slug = parts[0];
      if (slug !== "www" && slug !== "api") {
        const rootDomain = parts.slice(1).join(".");
        const portSuffix = port && port !== "443" && port !== "80" ? `:${port}` : "";
        setTeamInfo({ slug, teamsUrl: `${protocol}//${rootDomain}${portSuffix}/teams` });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      fetch("/api/events/count")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setUnreadCount(data.unread ?? 0); })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    // Re-fetch immediately when events are marked as read
    window.addEventListener("muleteam:events-changed", fetchCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("muleteam:events-changed", fetchCount);
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="relative flex h-14 items-center justify-between px-4">
        {/* Left: Logo + mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              aria-label={t("nav.menu")}
              className="md:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex items-center px-4 py-4 border-b border-border">
                <img src="/logo-horizontal.png" alt="MuleTeam" className="h-6 dark:hidden" />
                <img src="/logo-horizontal-dark.png" alt="MuleTeam" className="h-6 hidden dark:block" />
                <SheetTitle className="sr-only">MuleTeam</SheetTitle>
              </div>
              <nav className="flex flex-col py-2">
                {NAV_KEYS.map((item) => {
                  const isActive = item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "text-foreground font-medium bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t(item.labelKey)}
                      {item.href === "/" && unreadCount > 0 && (
                        <NotificationBadge count={unreadCount} size="sm" />
                      )}
                    </Link>
                  );
                })}
              </nav>
              {/* Switch Team in mobile menu */}
              {teamInfo && (
                <div className="border-t border-border">
                  <a
                    href={teamInfo.teamsUrl}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {t("nav.switchTeam")}
                  </a>
                </div>
              )}
              {/* Theme + Language in mobile menu */}
              <div className="border-t border-border px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">{t("nav.theme")}</p>
                  <button
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    aria-label={t("nav.toggleDarkMode")}
                    className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <svg className="dark:hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    <svg className="hidden dark:block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t("language")}</p>
                <div className="flex gap-1">
                  {LOCALES.map((loc) => (
                    <button
                      key={loc.value}
                      onClick={() => setLocale(loc.value)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        locale === loc.value
                          ? "bg-foreground text-background font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="select-none shrink-0 flex items-center">
            <img src="/logo-horizontal.png" alt="MuleTeam" className="h-6 dark:hidden" />
            <img src="/logo-horizontal-dark.png" alt="MuleTeam" className="h-6 hidden dark:block" />
          </Link>
          {teamInfo && (
            <>
              <span className="text-muted-foreground/50 hidden sm:inline">/</span>
              <a
                href={teamInfo.teamsUrl}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline truncate max-w-[120px]"
                title={t("nav.switchTeam")}
              >
                {teamInfo.slug}
              </a>
            </>
          )}
        </div>

        {/* Center: Navigation tabs (desktop only) — absolute centered to full navbar width */}
        <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
          <Tabs
            value={NAV_KEYS.find(item => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))?.href ?? "/"}
            onValueChange={(value) => router.push(value)}
            className="pointer-events-auto"
          >
          <TabsList variant="underline" size="sm" className="h-14 gap-0">
            {NAV_KEYS.map((item) => (
              <TabsTrigger key={item.href} value={item.href} className="h-14 px-3">
                {t(item.labelKey)}
                {item.href === "/" && unreadCount > 0 && (
                  <NotificationBadge count={unreadCount} size="sm" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        </div>

        {/* Right: User profile dropdown */}
        <div className="flex items-center">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center rounded-full focus:outline-none">
                <MemberAvatar type="human" name={user.name} size={28} avatarUrl={user.avatar_url} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-[220px]">
                <div className="flex flex-col gap-0.5 px-4 py-2.5">
                  <span className="text-[length:var(--font-size-body-base)] font-semibold text-[var(--label-primary)] truncate">
                    {user.name}
                  </span>
                  <span className="text-[length:var(--font-size-body-small)] text-[var(--label-secondary)] truncate">
                    {user.email}
                  </span>
                </div>
                <DropdownMenuSeparator className="mx-2" />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push(memberUrl(`human:${user.id}`))}>
                    <User className="mr-0.5 h-4 w-4" /> {t("nav.myProfile")}
                  </DropdownMenuItem>
                  {teamInfo && (
                    <DropdownMenuItem onClick={() => { window.location.href = teamInfo.teamsUrl; }}>
                      {t("nav.switchTeam")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Moon className="mr-0.5 h-4 w-4" /> {t("nav.toggleDarkMode")}
                    <Switch
                      size="md"
                      className="ml-auto"
                      checked={isDark}
                      onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
                    />
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Languages className="mr-0.5 h-4 w-4" /> {t("nav.language")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {LOCALES.map((loc) => (
                        <DropdownMenuItem key={loc.value} onSelect={() => setLocale(loc.value)}>
                          {loc.label} {locale === loc.value && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="mx-2" />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-[var(--color-red-100)]">
                  <LogOut className="mr-0.5 h-4 w-4" /> {t("nav.logOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
