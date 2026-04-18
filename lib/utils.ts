// Shared UI helpers.

/** Returns `singular` if n===1 else `pluralForm` (or `singular+'s'`). */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm || singular + 's')
}
