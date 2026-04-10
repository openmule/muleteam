import type { LucideIcon, LucideProps } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Design-system defaults for icons.
 * size: 24px (--icon-large), strokeWidth: 1.5
 */
const ICON_DEFAULTS = {
  size: 24,
  strokeWidth: 1.5,
} as const

/**
 * Predefined color presets that avoid SVG path overlap stacking.
 * Uses opaque base color + CSS opacity instead of rgba tokens.
 *
 * Mapping:
 *   "primary"   → --label-primary   (100%)  — same as no tint
 *   "secondary"  → --label-primary   (60%)   — matches --label-secondary
 *   "tertiary"   → --label-primary   (30%)   — matches --label-tertiary
 *   "quaternary" → --label-primary   (18%)   — matches --label-quaternary
 */
const colorPresets = {
  primary: "text-[var(--label-primary)] opacity-100",
  secondary: "text-[var(--label-primary)] opacity-60",
  tertiary: "text-[var(--label-primary)] opacity-30",
  quaternary: "text-[var(--label-primary)] opacity-[0.18]",
} as const

export interface IconProps extends Omit<LucideProps, "ref"> {
  /** A Lucide icon component, or a custom SVG icon following the same API */
  icon: LucideIcon
  /**
   * Safe color preset that avoids SVG path overlap stacking.
   * Use this instead of text-[var(--label-secondary)] etc.
   * For custom colors without alpha (e.g. text-[var(--color-red-1000)]),
   * use className directly — no overlap issue with opaque colors.
   */
  tint?: keyof typeof colorPresets
}

/**
 * Unified icon wrapper with design-system defaults (24px, strokeWidth 1.5).
 *
 * IMPORTANT: To avoid color stacking on overlapping SVG paths, use the
 * `tint` prop for semi-transparent label colors instead of applying
 * rgba color tokens via className:
 *
 *   ✅ <Icon icon={Search} tint="secondary" />
 *   ❌ <Icon icon={Search} className="text-[var(--label-secondary)]" />
 *
 * Opaque colors (e.g. --color-red-1000) are safe to use via className.
 */
export function Icon({ icon: IconComponent, tint, className, ...props }: IconProps) {
  return (
    <IconComponent
      {...ICON_DEFAULTS}
      className={cn("shrink-0", tint && colorPresets[tint], className)}
      {...props}
    />
  )
}
