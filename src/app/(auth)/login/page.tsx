"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  const t = useT();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("auth.loginFailed"));
        return;
      }

      window.location.href = "/";
    } catch {
      setError(t("auth.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6">
      <div className="text-center mb-6">
        <img src="/logo.svg" width={32} height={32} alt="MuleTeam" className="mx-auto mb-2" />
        <h1 className="text-xl font-semibold tracking-tight">MuleTeam</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("auth.subtitle")}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">{t("auth.email")}</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder={t("auth.placeholder.email")}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">{t("auth.password")}</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            placeholder={t("auth.placeholder.password")}
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("auth.noAccount")}
      </p>
    </div>
  );
}
