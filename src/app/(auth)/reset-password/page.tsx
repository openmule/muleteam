"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Icon } from "@/components/ui/icon";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";
import PixelBlast from "@/components/PixelBlast";

/* ── Scramble Reveal Hook ── */
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";

function useScrambleReveal(text: string, { charDelay = 20, scrambleTicks = 4, delay = 600 } = {}) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const maxLen = useMemo(() => Math.max(...lines.map(l => l.length)), [lines]);
  const [tick, setTick] = useState(-1);
  const prevText = useRef(text);

  useEffect(() => {
    if (text !== prevText.current) {
      setTick(-1);
      prevText.current = text;
    }
    const totalTicks = maxLen + scrambleTicks;
    const timeout = setTimeout(() => {
      let t = 0;
      const interval = setInterval(() => {
        t++;
        setTick(t);
        if (t >= totalTicks) clearInterval(interval);
      }, charDelay);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, charDelay, scrambleTicks, delay, maxLen]);

  const displayed = useMemo(() => {
    if (tick < 0) return lines.map(() => "").join("\n");
    return lines.map(line => {
      let result = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === " " || ch === "\n") { result += ch; continue; }
        const settled = tick - i;
        if (settled >= scrambleTicks) {
          result += ch;
        } else if (settled > 0) {
          result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        } else {
          result += " ";
        }
      }
      return result;
    }).join("\n");
  }, [lines, tick, scrambleTicks]);

  return displayed;
}

/* ── Reset Password Form (reads searchParams) ── */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !confirmPassword.trim()) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled = !password.trim() || !confirmPassword.trim() || loading;

  if (!token) {
    return (
      <div className="flex flex-col items-center" style={{ gap: "var(--space-400)" }}>
        <div
          className="flex items-center justify-center"
          style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(255, 59, 48, 0.15)" }}
        >
          <AlertCircle size={24} style={{ color: "var(--color-red-1000)" }} />
        </div>
        <div className="text-center flex flex-col" style={{ gap: "var(--space-100)" }}>
          <h1 className="font-bold" style={{ fontSize: "var(--font-size-title-page)", lineHeight: "150%", color: "var(--label-primary)" }}>
            Invalid Link
          </h1>
          <p style={{ fontSize: "var(--font-size-body-base)", color: "var(--label-secondary)" }}>
            This password reset link is invalid or missing the required token.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={() => router.push("/login")} style={{ marginTop: "var(--space-200)" }}>
          Back to Login
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center" style={{ gap: "var(--space-400)" }}>
        <div
          className="flex items-center justify-center"
          style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(48, 209, 88, 0.15)" }}
        >
          <CheckCircle size={24} style={{ color: "var(--color-green-1000, #30D158)" }} />
        </div>
        <div className="text-center flex flex-col" style={{ gap: "var(--space-100)" }}>
          <h1 className="font-bold" style={{ fontSize: "var(--font-size-title-page)", lineHeight: "150%", color: "var(--label-primary)" }}>
            Password Reset
          </h1>
          <p style={{ fontSize: "var(--font-size-body-base)", color: "var(--label-secondary)" }}>
            Your password has been updated successfully.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={() => router.push("/login")} style={{ marginTop: "var(--space-200)" }}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Title */}
      <div className="text-center flex flex-col" style={{ gap: "var(--space-100)" }}>
        <h1 className="font-bold whitespace-nowrap" style={{ fontSize: "var(--font-size-title-page)", lineHeight: "150%", color: "var(--label-primary)" }}>
          Reset Password
        </h1>
        <p style={{ fontSize: "var(--font-size-body-base)", color: "var(--label-secondary)" }}>
          Enter your new password below
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex flex-col" style={{ gap: "var(--space-300)" }}>
          {/* Error */}
          {error && (
            <div className="rounded-[8px] px-3 py-2 text-sm" style={{ backgroundColor: "var(--color-red-100)", color: "var(--color-red-1000)" }}>
              {error}
            </div>
          )}

          {/* New Password */}
          <InputGroup size="lg" className="!bg-transparent">
            <InputGroupAddon>
              <Lock size={16} />
            </InputGroupAddon>
            <InputGroupInput
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <InputGroupButton
              size="icon-sm"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              type="button"
            >
              <Icon icon={showPassword ? EyeOff : Eye} size={16} tint="tertiary" />
            </InputGroupButton>
          </InputGroup>

          {/* Confirm Password */}
          <InputGroup size="lg" className="!bg-transparent">
            <InputGroupAddon>
              <Lock size={16} />
            </InputGroupAddon>
            <InputGroupInput
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <InputGroupButton
              size="icon-sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              type="button"
            >
              <Icon icon={showConfirmPassword ? EyeOff : Eye} size={16} tint="tertiary" />
            </InputGroupButton>
          </InputGroup>

          {/* Submit */}
          <div style={{ paddingTop: "var(--space-400)" }}>
            <Button type="submit" size="lg" className="w-full" disabled={submitDisabled}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </div>

          {/* Back to login */}
          <div className="flex justify-center">
            <button
              type="button"
              className="cursor-pointer hover:underline"
              style={{ fontSize: "var(--font-size-footnote)", color: "var(--label-tertiary)" }}
              onClick={() => router.push("/login")}
            >
              Back to login
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ── Reset Password Page ── */
export default function ResetPasswordPage() {
  // Force dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const taglineText = "MuleTeam,\nAgent Native\nCollaboration.";
  const taglineDisplayed = useScrambleReveal(taglineText, { charDelay: 20, scrambleTicks: 4, delay: 0 });

  return (
    <div
      className="h-screen flex flex-col lg:flex-row relative overflow-hidden"
      style={{ backgroundColor: "var(--bg-grouped-primary)" }}
    >
      {/* PixelBlast background */}
      <div className="absolute inset-0 z-0">
        <PixelBlast
          variant="square"
          pixelSize={2}
          color="#999999"
          patternScale={2}
          patternDensity={1.6}
          enableRipples
          rippleSpeed={0.3}
          rippleThickness={0.1}
          rippleIntensityScale={1}
          speed={0.5}
          transparent
          edgeFade={0}
        />
      </div>

      {/* Left: Brand area */}
      <div className="relative z-10 hidden lg:flex flex-col flex-1 min-w-0" style={{ padding: "48px 0 48px 48px" }}>
        <div className="flex flex-col justify-between w-full mx-auto flex-1" style={{ maxWidth: 648, padding: "80px 0" }}>
          {/* Logo */}
          <img src="/logos/muleteam-mark-dark-badge.svg" alt="MuleTeam" width={64} height={64} />
          {/* Tagline */}
          <p
            className="whitespace-pre-line"
            style={{ fontWeight: 700, fontSize: "var(--font-size-title-display)", lineHeight: 1.3, color: "var(--label-primary)" }}
          >
            {taglineDisplayed}
          </p>
        </div>
      </div>

      {/* Mobile: Logo above card */}
      <div className="lg:hidden relative z-10 flex justify-center" style={{ padding: "64px 0" }}>
        <img src="/logos/muleteam-mark-dark-badge.svg" alt="MuleTeam" width={48} height={48} />
      </div>

      {/* Right: Reset password panel */}
      <div className="relative z-10 w-full lg:flex-1 flex flex-col p-[48px] lg:pl-0">
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            backgroundColor: "rgba(41, 41, 42, 0.6)",
            backdropFilter: "blur(var(--blur-control))",
            WebkitBackdropFilter: "blur(var(--blur-control))",
            borderRadius: "var(--radius-large-val)",
            boxShadow: "0 0 0 1px var(--border-color-primary), var(--shadow-medium)",
          }}
        >
          <div
            className="flex-1 flex flex-col max-w-[460px] mx-auto w-full overflow-y-auto"
            style={{ padding: "clamp(48px, 5vh, 80px) var(--space-800)" }}
          >
            {/* Form content -- vertically centered */}
            <div className="flex flex-col flex-1">
              <div className="flex-1 flex flex-col justify-start lg:justify-center max-w-[460px] mx-auto w-full" style={{ gap: 64 }}>
                <Suspense fallback={
                  <div className="text-center" style={{ color: "var(--label-secondary)" }}>Loading...</div>
                }>
                  <ResetPasswordForm />
                </Suspense>
              </div>

              {/* Bottom: Terms */}
              <p
                className="text-center"
                style={{
                  fontSize: "var(--font-size-caption)",
                  color: "var(--label-tertiary)",
                  lineHeight: 1.5,
                  marginTop: "auto",
                  paddingTop: 36,
                }}
              >
                By continuing, you agree to our{" "}
                <button className="underline cursor-pointer hover:opacity-70 transition-opacity">Terms of Service</button>{" "}
                and{" "}
                <button className="underline cursor-pointer hover:opacity-70 transition-opacity">Privacy Policy</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
