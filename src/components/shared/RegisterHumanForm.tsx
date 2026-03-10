"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generatePassword } from "./helpers";

export function RegisterHumanForm({ onSuccess }: { onSuccess: (name: string, email: string, password: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError("");
    const password = generatePassword();
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }
      onSuccess(name.trim(), email.trim(), password);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-2">
        <Label>Name</Label>
        <Input placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input placeholder="john@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button className="w-full" onClick={handleRegister} disabled={!name.trim() || !email.trim() || loading}>
        {loading ? "Registering..." : "Register"}
      </Button>
    </div>
  );
}
