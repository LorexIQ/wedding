export const DRINK_OPTIONS = ['wine', 'beer', 'spirits', 'non_alcoholic'] as const
export type DrinkOption = typeof DRINK_OPTIONS[number]

export const DRINK_LABELS: Record<DrinkOption, string> = {
  wine: 'Вино',
  beer: 'Пиво',
  spirits: 'Крепкое',
  non_alcoholic: 'Безалкогольное'
}
