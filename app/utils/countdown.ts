export interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Разбивает остаток в миллисекундах на части. Прошедшая дата даёт нули. */
export function splitRemaining(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60
  }
}
