"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

// ── Context ──

interface TabsListContextValue {
  variant: "segmented" | "underline"
  size: "default" | "sm"
}

const TabsListContext = React.createContext<TabsListContextValue>({
  variant: "segmented",
  size: "default",
})

// ── TabsList with animated indicator ──

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: "segmented" | "underline"
  size?: "default" | "sm"
}

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "segmented", size = "default", children, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
  })
  const initializedRef = React.useRef(false)

  const updateIndicator = React.useCallback(() => {
    const list = innerRef.current
    if (!list) return
    const activeTab = list.querySelector<HTMLElement>('[data-state="active"]')
    if (!activeTab) return

    const listRect = list.getBoundingClientRect()
    const tabRect = activeTab.getBoundingClientRect()

    if (variant === "segmented") {
      setIndicatorStyle({
        left: tabRect.left - listRect.left,
        top: tabRect.top - listRect.top,
        width: tabRect.width,
        height: tabRect.height,
        opacity: 1,
        transition: initializedRef.current ? "all 200ms ease" : "none",
      })
    } else {
      setIndicatorStyle({
        left: tabRect.left - listRect.left,
        bottom: 0,
        width: tabRect.width,
        height: 1,
        opacity: 1,
        transition: initializedRef.current ? "all 200ms ease" : "none",
      })
    }
    initializedRef.current = true
  }, [variant])

  React.useEffect(() => {
    const list = innerRef.current
    if (!list) return

    updateIndicator()

    const observer = new MutationObserver(updateIndicator)
    observer.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    })

    return () => observer.disconnect()
  }, [updateIndicator])

  // Merge refs
  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref]
  )

  return (
    <TabsListContext.Provider value={{ variant, size }}>
      <TabsPrimitive.List
        ref={mergedRef}
        className={cn(
          "relative inline-flex items-center",
          variant === "segmented" && "rounded-[12px] bg-[var(--fill-quaternary)] p-1 gap-1",
          variant === "underline" && "gap-5",
          className
        )}
        {...props}
      >
        {/* Animated indicator */}
        <div
          className={cn(
            "absolute pointer-events-none",
            variant === "segmented" && "rounded-[8px] bg-[var(--bg-grouped-quaternary)] dark:ring-1 dark:ring-inset dark:ring-[var(--border-color-primary)]",
            variant === "underline" && "bg-[var(--label-primary)]",
          )}
          style={indicatorStyle}
        />
        {children}
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

// ── TabsTrigger ──

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { variant, size } = React.useContext(TabsListContext)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const [isActive, setIsActive] = React.useState(false)

  // Watch data-state attribute to determine active state
  React.useEffect(() => {
    const el = triggerRef.current
    if (!el) return
    const check = () => setIsActive(el.getAttribute("data-state") === "active")
    check()
    const observer = new MutationObserver(check)
    observer.observe(el, { attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [])

  // Merge refs
  const mergedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
    },
    [ref]
  )

  const gapAndFont = cn(
    size === "default" && "gap-1.5 text-[length:var(--font-size-body-base)] [&_svg]:size-4",
    size === "sm" && "gap-1 text-[length:var(--font-size-subheadline)] [&_svg]:size-4",
  )

  return (
    <TabsPrimitive.Trigger
      ref={mergedRef}
      className={cn(
        "relative z-[1] whitespace-nowrap transition-colors focus-visible:outline-solid focus-visible:outline-[4px] focus-visible:outline-[var(--gray-negative-200)] focus-visible:-outline-offset-1 disabled:pointer-events-none disabled:opacity-50",
        "text-[var(--label-secondary)] hover:text-[var(--label-primary)]",
        variant === "segmented" && "rounded-[8px]",
        variant === "segmented" && size === "default" && "h-9 px-4",
        variant === "segmented" && size === "sm" && "h-7 px-3",
        variant === "segmented" && "data-[state=active]:text-[var(--gray-negative-1000)]",
        variant === "underline" && "rounded-none",
        variant === "underline" && size === "default" && "h-9",
        variant === "underline" && size === "sm" && "h-9",
        variant === "underline" && "data-[state=active]:text-[var(--label-primary)]",
        className
      )}
      style={{ display: "inline-grid", alignItems: "center", justifyItems: "center" }}
      {...props}
    >
      {/* Invisible bold spacer — reserves the bold width to prevent layout shift */}
      <span
        className={cn("flex items-center justify-center font-medium pointer-events-none", gapAndFont)}
        style={{ gridArea: "1 / 1", visibility: "hidden" }}
        aria-hidden="true"
      >
        {children}
      </span>
      {/* Visible content */}
      <span
        className={cn(
          "flex items-center justify-center",
          gapAndFont,
          "[&_svg]:text-[var(--label-primary)]",
          isActive ? "font-medium [&_svg]:opacity-100" : "font-normal [&_svg]:opacity-60",
        )}
        style={{ gridArea: "1 / 1" }}
      >
        {children}
      </span>
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

// ── TabsContent ──

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-solid focus-visible:outline-[4px] focus-visible:outline-[var(--gray-negative-200)] focus-visible:-outline-offset-1",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
