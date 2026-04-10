"use client"

import * as React from "react"
import { Plus, Link, ArrowUp, Square, X, FileText, ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface ChatInputFile {
  id: string
  name: string
  type: "image" | "file"
  size?: string
  src?: string
  icon?: React.ReactNode
}

export interface ModelOption {
  value: string
  label: string
}

export interface ChatInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  files?: ChatInputFile[]
  onFileRemove?: (id: string) => void
  onAttach?: () => void
  onSend?: () => void
  onStop?: () => void
  loading?: boolean
  disabled?: boolean
  size?: "default" | "sm"
  className?: string
  model?: string
  models?: ModelOption[]
  onModelChange?: (value: string) => void
}

const sizeConfig = {
  default: {
    container: "rounded-[var(--radius-medium)] p-3 shadow-[var(--shadow-medium)]",
    attachments: "gap-2 mb-2",
    textarea: "px-1 pt-1 pb-6 text-[length:var(--font-size-body-base)]",
    toolbar: "px-0 pt-2",
    buttonSize: "default" as const,
    sendIcon: "size-[var(--icon-large)]",
    stopIcon: "size-[18px]",
  },
  sm: {
    container: "rounded-[var(--radius-small)] p-2 shadow-[var(--shadow-small)]",
    attachments: "gap-1.5 mb-1.5",
    textarea: "px-0.5 pt-0.5 pb-3 text-[length:var(--font-size-body-small)]",
    toolbar: "px-0 pt-1",
    buttonSize: "xs" as const,
    sendIcon: "size-[var(--icon-medium)]",
    stopIcon: "size-[14px]",
  },
} as const

const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "Message...",
      files = [],
      onFileRemove,
      onAttach,
      onSend,
      onStop,
      loading = false,
      disabled = false,
      size = "default",
      className,
      model,
      models = [],
      onModelChange,
    },
    ref
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const [pressed, setPressed] = React.useState(false)
    const s = sizeConfig[size]

    const hasContent = !!(value && value.trim().length > 0)

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }, [])

    React.useEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !loading) {
        e.preventDefault()
        if (hasContent) onSend?.()
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value)
    }

    return (
      <TooltipProvider delayDuration={300}>
        <div
          ref={ref}
          className={cn(
            "border border-input bg-[var(--bg-grouped-quaternary)] transition-all duration-150 focus-within:border-[var(--accent-primary-1000)]",
            s.container,
            pressed && "translate-y-px",
            disabled && "opacity-50 pointer-events-none",
            className
          )}
        >
          {/* Attachments */}
          {files.length > 0 && (
            <div className={cn("flex flex-wrap", s.attachments)}>
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative"
                >
                  {file.type === "file" ? (
                    <div className="flex items-center gap-[6px] w-[168px] h-14 rounded-[var(--radius-small)] bg-[var(--fill-quaternary)] pl-[8px] pr-[12px]">
                      <div className="shrink-0 size-9 flex items-center justify-center">
                        {file.icon || <FileText className="size-8 text-[var(--label-primary)] opacity-60" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-[length:var(--font-size-subheadline)] text-[var(--label-primary)]">
                          {file.name}
                        </span>
                        {file.size && (
                          <span className="text-[length:var(--font-size-caption)] text-[var(--label-tertiary)] mt-[-4px]">
                            {file.size}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-14 h-14 rounded-[var(--radius-small)] overflow-hidden bg-secondary">
                      {file.src ? (
                        <img src={file.src} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="size-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-[var(--radius-small)] ring-1 ring-inset ring-[var(--border-color-tertiary)]" />
                    </div>
                  )}
                  {/* Close button — visible on hover */}
                  <button
                    type="button"
                    onClick={() => onFileRemove?.(file.id)}
                    className="absolute top-[2px] right-[2px] size-5 rounded-full bg-[var(--gray-positive-1000)] text-[var(--gray-negative-1000)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            placeholder={placeholder}
            disabled={disabled || loading}
            rows={1}
            className={cn(
              "w-full resize-none border-0 bg-transparent placeholder:text-[var(--label-tertiary)] focus-visible:outline-none",
              s.textarea
            )}
            style={{ maxHeight: 200 }}
          />

          {/* Toolbar */}
          <div className={cn("flex items-center justify-between", s.toolbar)}>
            <ButtonGroup spacing="spaced">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size={s.buttonSize}
                    icon
                    onClick={onAttach}
                  >
                    <Plus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size={s.buttonSize}
                    icon
                  >
                    <Link />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Connector</TooltipContent>
              </Tooltip>

              {models.length > 0 && (
                <Select value={model} onValueChange={onModelChange}>
                  <SelectTrigger className={cn(
                    "w-auto border-input bg-[var(--bg-grouped-quaternary)] gap-1",
                    size === "sm" ? "h-7 px-2 text-[length:var(--font-size-caption)] rounded-[var(--radius-h28)]" : "h-9 px-3 text-[length:var(--font-size-subheadline)] rounded-[var(--radius-h36)]"
                  )}>
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </ButtonGroup>

            <Tooltip>
              <TooltipTrigger asChild>
                {loading ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size={s.buttonSize}
                    icon
                    className="bg-[var(--fill-tertiary)] text-[var(--label-primary)] hover:bg-[var(--fill-secondary)] hover:opacity-100"
                    onClick={onStop}
                  >
                    <Square className={cn(s.stopIcon, "fill-current")} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    size={s.buttonSize}
                    icon
                    disabled={!hasContent}
                    onClick={onSend}
                  >
                    <ArrowUp className={s.sendIcon} />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>{loading ? "Stop" : "Send"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    )
  }
)
ChatInput.displayName = "ChatInput"

export { ChatInput }
