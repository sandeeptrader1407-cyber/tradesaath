const IST_OFFSET_MIN = 330 // +05:30

export function getTodayIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60 * 1000)
  return ist.toISOString().split('T')[0]
}

export function getStartOfWeekIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60 * 1000)
  const day = ist.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day // ISO week starts Monday
  ist.setUTCDate(ist.getUTCDate() + diff)
  return ist.toISOString().split('T')[0]
}

export function getStartOfMonthIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60 * 1000)
  ist.setUTCDate(1)
  return ist.toISOString().split('T')[0]
}

export function isSameDayIST(date: string, reference?: Date): boolean {
  return date === getTodayIST(reference)
}
