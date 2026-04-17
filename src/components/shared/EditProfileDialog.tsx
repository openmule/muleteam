"use client";

import { useState, useEffect, useCallback, KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { useT } from "@/lib/i18n";
import { X } from "lucide-react";

interface EditUserProfileProps {
  type: "user";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  tags?: string[];
  onSaved?: (data: { name: string; description: string; tags?: string[] }) => void;
}

interface EditAgentProfileProps {
  type: "agent";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  name: string;
  description?: string;
  tags?: string[];
  onSaved?: (data: { name: string; description: string; tags: string[] }) => void;
}

type EditProfileDialogProps = EditUserProfileProps | EditAgentProfileProps;

export function EditProfileDialog(props: EditProfileDialogProps) {
  const { type, open, onOpenChange } = props;
  const t = useT();

  const [nameValue, setNameValue] = useState(props.name);
  const [descriptionValue, setDescriptionValue] = useState(props.description ?? "");
  const [tags, setTags] = useState<string[]>(props.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNameValue(props.name);
      setDescriptionValue(props.description ?? "");
      setTags(props.tags ?? []);
      setTagInput("");
      setSaving(false);
      setError(null);
    }
  }, [open, props.name, props.description, props.tags]);

  const addTag = useCallback(() => {
    const value = tagInput.trim();
    if (value && !tags.includes(value)) {
      setTags((prev) => [...prev, value]);
    }
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag();
      } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [addTag, tagInput, tags]
  );

  const handleSave = async () => {
    const trimmedName = nameValue.trim();
    if (!trimmedName) {
      setError(t("profile.nameRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (type === "user") {
        const p = props as EditUserProfileProps;
        const res = await fetch(`/api/users/${p.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            description: descriptionValue.trim(),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save");
        }

        p.onSaved?.({ name: trimmedName, description: descriptionValue.trim() });
      } else {
        const p = props as EditAgentProfileProps;
        const res = await fetch(`/api/agents/${p.agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            description: descriptionValue.trim(),
            capabilities: tags,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save");
        }

        p.onSaved?.({ name: trimmedName, description: descriptionValue.trim(), tags });
      }

      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isUser = type === "user";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isUser ? t("profile.editProfile") : t("profile.editAgentProfile")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isUser ? t("profile.editProfile") : t("profile.editAgentProfile")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Avatar (non-editable) */}
          <div className="flex justify-center">
            <MemberAvatar
              type={isUser ? "human" : "agent"}
              name={props.name}
              size={72}
              avatarUrl={isUser ? (props as EditUserProfileProps).avatarUrl : undefined}
            />
          </div>

          {/* Name field */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-profile-name">
              {isUser ? t("profile.userName") : t("profile.agentName")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              id="edit-profile-name"
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder={isUser ? t("auth.placeholder.name") : t("agent.placeholder.name")}
              aria-invalid={error === t("profile.nameRequired") ? "true" : undefined}
            />
          </div>

          {/* Description / Bio field */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-profile-description">
              {isUser ? t("profile.bio") : t("profile.description")}
            </Label>
            <Textarea
              id="edit-profile-description"
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              placeholder={isUser ? "" : t("agent.placeholder.description")}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>{t("profile.tags")}</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="primary" size="sm" className="gap-1 pr-1 cursor-default">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 size-3.5 transition-colors"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(); }}
              placeholder={t("profile.tagsPlaceholder")}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("profile.saving") : t("profile.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
