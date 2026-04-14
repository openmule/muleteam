"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"

/* ============================================================
   TitleBar — composite pattern for page/section headers
   Combines title, optional breadcrumb, description, and actions
   ============================================================ */

function TitleBar({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="titlebar"
      className={cn(
        "flex items-center gap-[var(--space-300)] shrink-0",
        "h-16 px-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function TitleBarHeading({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="titlebar-heading"
      className={cn("flex flex-col justify-center gap-[2px] min-w-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function TitleBarTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="titlebar-title"
      className={cn(
        "text-[length:var(--font-size-subheading)] font-semibold leading-tight truncate",
        "text-[var(--label-primary)]",
        className
      )}
      {...props}
    />
  )
}

function TitleBarDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="titlebar-description"
      className={cn(
        "text-[length:var(--font-size-footnote)] leading-tight truncate",
        "text-[var(--label-tertiary)]",
        className
      )}
      {...props}
    />
  )
}

function TitleBarActions({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="titlebar-actions"
      className={cn("ml-auto flex items-center gap-[var(--space-200)] shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function TitleBarBack({ className, children = "Back", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="titlebar-back"
      className={cn(
        "flex items-center gap-[6px] px-2 py-1.5 rounded-[6px] cursor-pointer ml-[-4px]",
        "text-[length:var(--font-size-body-small)] text-[var(--label-primary)]",
        "hover:bg-[var(--fill-tertiary)] transition-colors",
        className
      )}
      {...props}
    >
      <ArrowLeft className="size-4" strokeWidth={1} />
      {children}
    </button>
  )
}

export {
  TitleBar,
  TitleBarHeading,
  TitleBarTitle,
  TitleBarDescription,
  TitleBarActions,
  TitleBarBack,
}
