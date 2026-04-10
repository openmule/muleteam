"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: "default" | "md" | "sm"
}

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = "default", ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:bg-[var(--fill-secondary)] data-[state=checked]:bg-[var(--gray-negative-1000)]",
      size === "default" && "h-6 w-11",
      size === "md" && "h-[18px] w-[32px]",
      size === "sm" && "h-3 w-[22px]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-full ring-0 transition-transform",
        "data-[state=unchecked]:bg-[var(--gray-white-1000)] data-[state=checked]:bg-[var(--gray-positive-1000)]",
        size === "default" && "size-5 data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-[2px]",
        size === "md" && "size-[14px] data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-[2px]",
        size === "sm" && "size-2 data-[state=checked]:translate-x-[12px] data-[state=unchecked]:translate-x-[2px]",
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
