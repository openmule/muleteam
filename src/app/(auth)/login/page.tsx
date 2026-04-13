"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Icon } from "@/components/ui/icon";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
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

/* ── Inline Error ── */
function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" style={{ fontSize: "var(--font-size-footnote)", color: "var(--color-red-1000)", marginTop: 4 }}>
      {children}
    </div>
  );
}

/* ── Login Page ── */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotError("");
    setForgotLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        setForgotError(data.error || "Something went wrong");
        return;
      }

      setForgotSuccess(true);
    } catch {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const submitDisabled = !email.trim() || !password.trim() || loading;

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

      {/* Right: Login panel */}
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
            {/* Form content — vertically centered */}
            <div className="flex flex-col flex-1">
              <div className="flex-1 flex flex-col justify-start lg:justify-center max-w-[460px] mx-auto w-full" style={{ gap: 64 }}>
                {forgotMode ? (
                  /* ── Forgot Password Mode ── */
                  <>
                    {/* Title */}
                    <div className="text-center flex flex-col" style={{ gap: "var(--space-100)" }}>
                      <h1 className="font-bold whitespace-nowrap" style={{ fontSize: "var(--font-size-title-page)", lineHeight: "150%", color: "var(--label-primary)" }}>
                        Forgot Password
                      </h1>
                      <p style={{ fontSize: "var(--font-size-body-base)", color: "var(--label-secondary)" }}>
                        {forgotSuccess
                          ? "If an account exists with that email, a reset link has been sent."
                          : "Enter your email and we'll send you a reset link"
                        }
                      </p>
                    </div>

                    {!forgotSuccess ? (
                      <form onSubmit={handleForgotSubmit} className="flex flex-col">
                        <div className="flex flex-col" style={{ gap: "var(--space-300)" }}>
                          {/* Error */}
                          {forgotError && (
                            <div className="rounded-[8px] px-3 py-2 text-sm" style={{ backgroundColor: "var(--color-red-100)", color: "var(--color-red-1000)" }}>
                              {forgotError}
                            </div>
                          )}

                          {/* Email */}
                          <InputGroup size="lg" className="!bg-transparent">
                            <InputGroupAddon>
                              <Mail size={16} />
                            </InputGroupAddon>
                            <InputGroupInput
                              type="email"
                              placeholder="Email address"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              autoComplete="email"
                            />
                          </InputGroup>

                          {/* Submit */}
                          <div style={{ paddingTop: "var(--space-400)" }}>
                            <Button type="submit" size="lg" className="w-full" disabled={!forgotEmail.trim() || forgotLoading}>
                              {forgotLoading ? "Sending..." : "Send Reset Link"}
                            </Button>
                          </div>

                          {/* Back to login */}
                          <div className="flex justify-center">
                            <button
                              type="button"
                              className="cursor-pointer hover:underline inline-flex items-center"
                              style={{ fontSize: "var(--font-size-footnote)", color: "var(--label-tertiary)", gap: "var(--space-100)" }}
                              onClick={() => { setForgotMode(false); setForgotError(""); }}
                            >
                              <ArrowLeft size={12} />
                              Back to login
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col" style={{ gap: "var(--space-300)" }}>
                        <div style={{ paddingTop: "var(--space-200)" }}>
                          <Button size="lg" className="w-full" onClick={() => { setForgotMode(false); setForgotSuccess(false); setForgotEmail(""); }}>
                            Back to Login
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Normal Login Mode ── */
                  <>
                    {/* Title */}
                    <div className="text-center flex flex-col" style={{ gap: "var(--space-100)" }}>
                      <h1 className="font-bold whitespace-nowrap" style={{ fontSize: "var(--font-size-title-page)", lineHeight: "150%", color: "var(--label-primary)" }}>
                        Welcome to MuleTeam
                      </h1>
                      <p style={{ fontSize: "var(--font-size-body-base)", color: "var(--label-secondary)" }}>
                        Sign in to your account
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

                        {/* Email */}
                        <InputGroup size="lg" className="!bg-transparent">
                          <InputGroupAddon>
                            <Mail size={16} />
                          </InputGroupAddon>
                          <InputGroupInput
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                          />
                        </InputGroup>

                        {/* Password */}
                        <InputGroup size="lg" className="!bg-transparent">
                          <InputGroupAddon>
                            <Lock size={16} />
                          </InputGroupAddon>
                          <InputGroupInput
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
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

                        {/* Forgot password */}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="cursor-pointer hover:underline"
                            style={{ fontSize: "var(--font-size-footnote)", color: "var(--label-tertiary)" }}
                            onClick={() => { setForgotMode(true); setError(""); }}
                          >
                            Forgot password?
                          </button>
                        </div>

                        {/* Submit */}
                        <div style={{ paddingTop: "var(--space-400)" }}>
                          <Button type="submit" size="lg" className="w-full" disabled={submitDisabled}>
                            {loading ? "Signing in..." : "Sign In"}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </>
                )}
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
