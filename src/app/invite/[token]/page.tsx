"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { I18nProvider, useT } from "@/lib/i18n";

function InvitePage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/invites/${token}`);
        if (res.ok) {
          const data = await res.json();
          setValid(data.valid === true);
        }
      } catch {
        setValid(false);
      } finally {
        setValidating(false);
      }
    }
    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("invite.passwordMismatch"));
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("invite.failed"));
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      setError(t("invite.failed"));
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 text-center">
          <img src="/logo.svg" width={32} height={32} alt="MuleTeam" className="mx-auto mb-2" />
          <h1 className="text-xl font-semibold tracking-tight mb-2">MuleTeam</h1>
          <p className="text-sm text-muted-foreground">{t("invite.invalid")}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 text-center">
          <img src="/logo.svg" width={32} height={32} alt="MuleTeam" className="mx-auto mb-2" />
          <h1 className="text-xl font-semibold tracking-tight mb-2">MuleTeam</h1>
          <p className="text-sm text-[var(--color-green-1000)]">{t("invite.success")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6">
        <div className="text-center mb-6">
          <img src="/logo.svg" width={32} height={32} alt="MuleTeam" className="mx-auto mb-2" />
          <h1 className="text-xl font-semibold tracking-tight">{t("invite.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("invite.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">{t("auth.name")}</Label>
            <Input
              id="invite-name"
              placeholder={t("auth.placeholder.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("auth.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("auth.placeholder.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">{t("auth.password")}</Label>
            <Input
              id="invite-password"
              type="password"
              placeholder={t("auth.placeholder.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-confirm-password">{t("invite.confirmPassword")}</Label>
            <Input
              id="invite-confirm-password"
              type="password"
              placeholder={t("auth.placeholder.password")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-description">{t("invite.description")}</Label>
            <Input
              id="invite-description"
              placeholder={t("agent.placeholder.description")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim() || !email.trim() || !password}>
            {loading ? t("invite.registering") : t("invite.register")}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <I18nProvider>
      <InvitePage />
    </I18nProvider>
  );
}
