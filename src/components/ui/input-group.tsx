"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const inputGroupSizeMap = {
  default: { height: "h-9", radius: "rounded-[var(--radius-h36)]" },
  lg: { height: "h-10", radius: "rounded-[var(--radius-h40)]" },
} as const

type InputGroupSize = keyof typeof inputGroupSizeMap

const InputGroupSizeContext = React.createContext<InputGroupSize>("default")

function InputGroup({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: InputGroupSize }) {
  const s = inputGroupSizeMap[size]
  return (
    <InputGroupSizeContext.Provider value={size}>
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex w-full items-center border-0 shadow-[0_0_0_1px_var(--input)] bg-[var(--bg-grouped-quaternary)] outline-none",
        s.height, s.radius,
        "min-w-0 has-[>textarea]:h-auto",

        // Variants based on alignment.
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "has-[[data-slot=input-group-control]:focus-visible]:outline-solid has-[[data-slot=input-group-control]:focus-visible]:outline-[4px] has-[[data-slot=input-group-control]:focus-visible]:outline-[var(--gray-negative-200)] has-[[data-slot=input-group-control]:focus-visible]:outline-offset-[1px] [&_[data-slot=input-group-control]:focus-visible]:outline-none",

        // Error state.
        "has-[[data-slot][aria-invalid=true]]:shadow-[0_0_0_1px_var(--color-red-1000)]",

        className
      )}
      {...props}
    />
    </InputGroupSizeContext.Provider>
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-[length:var(--font-size-body-small)] font-normal text-[var(--label-secondary)] select-none group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4 [&_svg]:text-[var(--label-primary)] [&_svg]:opacity-60",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3",
        "inline-end":
          "order-last pr-3",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "relative flex items-center gap-2 text-[length:var(--font-size-body-small)] font-normal shadow-none rounded-none self-stretch hover:bg-transparent hover:opacity-100 active:translate-y-px before:absolute before:inset-0 before:-z-10 before:transition-colors hover:before:bg-[var(--fill-quaternary)]",
  {
    variants: {
      size: {
        xs: "gap-1 px-[14px] [&>svg:not([class*='size-'])]:size-3.5",
        sm: "gap-1.5 px-[16px]",
        "icon-xs": "px-[16px] [&>svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "px-[18px]",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  const groupSize = React.useContext(InputGroupSizeContext)
  const radiusClass = groupSize === "lg" ? "rounded-r-[var(--radius-h40)] before:rounded-r-[var(--radius-h40)]" : "rounded-r-[var(--radius-h36)] before:rounded-r-[var(--radius-h36)]"
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), radiusClass, className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-[length:var(--font-size-body-small)] text-[var(--label-secondary)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-[var(--label-primary)] [&_svg]:opacity-60",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:outline-none",
        className
      )}
      {...props}
    />
  )
}

function InputGroupDivider({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-divider"
      className={cn("flex items-center self-stretch", className)}
      {...props}
    >
      <div className="h-full w-px bg-input" />
    </div>
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupDivider,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
