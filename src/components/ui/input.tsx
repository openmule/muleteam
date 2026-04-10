import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full rounded-[var(--radius-h36)] border border-input bg-[var(--bg-grouped-quaternary)] px-3 py-2 text-[length:var(--font-size-body-small)] file:border-0 file:bg-transparent file:text-[length:var(--font-size-body-small)] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-solid focus-visible:outline-[4px] focus-visible:outline-[var(--gray-negative-200)] focus-visible:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
