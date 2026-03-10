"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterAgentForm({ onSuccess }: { onSuccess: (name: string, token: string, description: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }
      const data = await res.json();
      onSuccess(data.agent.name, data.token, data.agent.description);
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
        <Label>Agent Name</Label>
        <Input placeholder="e.g. Coder" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input placeholder="Frontend developer" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button className="w-full" onClick={handleRegister} disabled={!name.trim() || loading}>
        {loading ? "Registering..." : "Register"}
      </Button>
    </div>
  );
}
