"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getInitials } from "@/components/shared/helpers";
import { useI18n, LOCALES } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV_KEYS = [
  { href: "/", labelKey: "nav.home" },
  { href: "/channels", labelKey: "nav.channels" },
  { href: "/members", labelKey: "nav.members" },
  { href: "/files", labelKey: "nav.files" },
  { href: "/docs", labelKey: "nav.docs" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="md:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
                <img src="/logo.svg" width={20} height={20} alt="" />
                <SheetTitle className="text-base font-semibold tracking-tight">MuleTeam</SheetTitle>
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
                      className={`px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "text-foreground font-medium bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
              {/* Language selector in mobile menu */}
              <div className="border-t border-border px-4 py-3">
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

          <Link href="/" className="text-base font-semibold tracking-tight select-none shrink-0 flex items-center gap-2">
            <img src="/logo.svg" width={20} height={20} alt="" />
            <span className="hidden sm:inline">MuleTeam</span>
          </Link>
        </div>

        {/* Center: Navigation (desktop only) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_KEYS.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isActive
                    ? "text-foreground font-medium bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Right: Language selector (desktop) + User dropdown */}
        <div className="flex items-center gap-2">
          {/* Desktop language selector */}
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden md:flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{locale.toUpperCase()}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {LOCALES.map((loc) => (
                <DropdownMenuItem
                  key={loc.value}
                  onClick={() => setLocale(loc.value)}
                  className={locale === loc.value ? "font-medium" : ""}
                >
                  {loc.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {getInitials(user.name)}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/members/human/${user.id}`)}>
                  {t("nav.myProfile")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  {t("nav.logOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
