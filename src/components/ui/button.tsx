import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[4px] whitespace-nowrap text-[length:var(--font-size-body-small)] font-normal transition-colors focus-visible:outline-solid focus-visible:outline-[4px] focus-visible:outline-[var(--gray-negative-200)] focus-visible:-outline-offset-1 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&>svg:first-child]:ml-[-2px] [&>svg:last-child]:mr-[-2px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        "outline-filled":
          "border border-input bg-[var(--bg-grouped-quaternary)] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-[var(--fill-tertiary)] text-secondary-foreground hover:bg-[var(--fill-primary)]",
        ghost: "hover:opacity-60",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "bg-[var(--accent-primary-1000)] text-[var(--gray-white-1000)] hover:bg-[var(--accent-primary-1000)]/90",
      },
      size: {
        xs: "h-7 rounded-[var(--radius-h28)] px-2 text-[length:var(--font-size-caption)]",
        sm: "h-8 rounded-[var(--radius-h32)] px-3",
        default: "h-9 rounded-[var(--radius-h36)] px-4 py-2",
        lg: "h-10 rounded-[var(--radius-h40)] px-8",
        xl: "h-[60px] rounded-[var(--radius-h60)] px-10 text-[length:var(--font-size-body-base)]",
      },
      icon: {
        true: "px-0 [&>svg:first-child]:ml-0 [&>svg:last-child]:mr-0",
        false: "",
      },
    },
    compoundVariants: [
      { icon: true, size: "xs", class: "w-7" },
      { icon: true, size: "sm", class: "w-8" },
      { icon: true, size: "default", class: "w-9" },
      { icon: true, size: "lg", class: "w-10" },
      { icon: true, size: "xl", class: "w-[60px]" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      icon: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, icon, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, icon, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
