/**
 * Shared P&L formatting utilities.
 * Single source of truth for currency display across all pages and APIs.
 */

/**
 * Format P&L with +/- prefix. Use for card deltas and metrics where emphasis matters.
 * Examples: "+₹1,234", "-₹5,678", "₹0"
 */
export function formatPnl(value: number): string {
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs)
  if (value < 0) return `-₹${formatted}`
  if (value > 0) return `+₹${formatted}`
  return '₹0'
}

/**
 * Format P&L without +/- prefix. Use for banners and tables where sign is implicit.
 * Examples: "-₹1,234", "₹5,678", "₹0"
 */
export function formatPnlPlain(value: number): string {
  const abs = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(value))
  if (value < 0) return `-₹${abs}`
  return `₹${abs}`
}
