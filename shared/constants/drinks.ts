export const DRINK_OPTIONS = [
  'vine_red',
  'vine_whire',
  'sparkling',
  'scotch',
  'vodka',
  'moonshine',
  'rum',
  'martini',
  'none'
] as const

export type DrinkOption = typeof DRINK_OPTIONS[number]

export const DRINK_LABELS: Record<DrinkOption, string> = {
  vine_red: 'Вино красное',
  vine_whire: 'Вино белое',
  sparkling: 'Шампанское',
  scotch: 'Виски',
  vodka: 'Водка',
  moonshine: 'Самогонка',
  rum: 'Ром',
  martini: 'Мартини',
  none: 'Не пью'
}

/** Вариант «не пью» — не сочетается ни с чем остальным. */
export const NO_DRINK: DrinkOption = 'none'

/**
 * Набор напитков корректен, если «не пью» стоит либо в одиночестве,
 * либо не стоит вовсе. Проверяется и на клиенте, и на сервере.
 */
export function isDrinkSetValid(drinks: readonly string[]): boolean {
  return !drinks.includes(NO_DRINK) || drinks.length === 1
}

/**
 * Возвращает новый набор после клика по варианту `toggled`:
 * повторный клик снимает выбор, «не пью» вытесняет алкоголь и наоборот.
 * Гость не должен получать ошибку за то, что передумал.
 */
export function normalizeDrinks(current: readonly string[], toggled: string): string[] {
  if (current.includes(toggled)) {
    return current.filter(drink => drink !== toggled)
  }
  if (toggled === NO_DRINK) {
    return [NO_DRINK]
  }
  return [...current.filter(drink => drink !== NO_DRINK), toggled]
}
