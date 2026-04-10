import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border-transparent font-normal whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--fill-tertiary)] text-secondary-foreground",
        outline: "border border-input text-foreground",
        accent:
          "bg-[var(--accent-primary-100)] text-[var(--accent-primary-1000)]",
        destructive:
          "bg-[var(--color-red-100)] text-[var(--color-red-1000)]",
        green:
          "bg-[var(--color-green-100)] text-[var(--color-green-1000)]",
        yellow:
          "bg-[var(--color-yellow-100)] text-[var(--color-yellow-1000)]",
        blue:
          "bg-[var(--color-blue-100)] text-[var(--color-blue-1000)]",
        purple:
          "bg-[var(--color-purple-100)] text-[var(--color-purple-1000)]",
        cyan:
          "bg-[var(--color-cyan-100)] text-[var(--color-cyan-1000)]",
        pink:
          "bg-[var(--color-pink-100)] text-[var(--color-pink-1000)]",
      },
      size: {
        sm: "h-5 min-w-5 px-2 gap-0.5 text-[length:var(--font-size-caption)] [&_svg]:size-3",
        default: "h-6 min-w-6 px-2.5 gap-1.5 text-[length:var(--font-size-caption)] [&_svg]:size-3.5 [&>svg:first-child]:-ml-0.5 [&>svg:last-child]:-mr-0.5",
        lg: "h-7 min-w-7 px-3 gap-1.5 text-[length:var(--font-size-body-small)] [&_svg]:size-4 [&>svg:first-child]:-ml-0.5 [&>svg:last-child]:-mr-0.5",
      },
    },
    defaultVariants: {
      variant: "accent",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

/* ── NotificationBadge ── */

const notificationBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-normal leading-none",
  {
    variants: {
      intensity: {
        strong: "bg-[var(--color-red-1000)] text-[var(--gray-white-1000)]",
        subtle: "bg-[var(--accent-primary-100)] text-[var(--accent-primary-1000)]",
      },
      size: {
        sm: "h-4 min-w-4 px-1 text-[length:var(--font-size-micro)]",
        default: "h-5 min-w-5 px-1.5 text-[length:var(--font-size-caption)]",
        lg: "h-6 min-w-6 px-2 text-[length:var(--font-size-body-small)]",
      },
    },
    defaultVariants: {
      intensity: "strong",
      size: "default",
    },
  }
)

export interface NotificationBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof notificationBadgeVariants> {
  count: number
}

function NotificationBadge({ className, intensity, size, count, ...props }: NotificationBadgeProps) {
  const display = count > 99 ? "99+" : String(count)
  return (
    <div
      className={cn(notificationBadgeVariants({ intensity, size }), className)}
      {...props}
    >
      {display}
    </div>
  )
}

/* ── NotificationDot — pure red dot, no number ── */

function NotificationDot({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("size-2.5 rounded-full bg-[var(--color-red-1000)]", className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, NotificationBadge, notificationBadgeVariants, NotificationDot }
