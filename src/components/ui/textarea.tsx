import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[var(--radius-h36)] border border-input bg-[var(--bg-grouped-quaternary)] px-3 py-2 text-[length:var(--font-size-body-small)] placeholder:text-[var(--label-tertiary)] transition-[border-color] focus-visible:outline-solid focus-visible:outline-[4px] focus-visible:outline-[var(--gray-negative-200)] focus-visible:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
