import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns a CSS calc() expression: height × --radius-ratio. Use for dynamic heights. */
export function radiusByHeight(heightPx: number): string {
  return `calc(${heightPx}px * var(--radius-ratio))`
}

/** Generate a short random ID */
export function nanoid(size = 12): string {
  return crypto.randomBytes(size).toString("base64url").slice(0, size)
}
