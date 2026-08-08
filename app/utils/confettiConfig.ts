// Тонкая настройка салюта — цвета, физика, интенсивность и тайминг
// залпов. Сама анимация (частицы, канвас) живёт в TheConfetti.vue и
// сюда не заглядывает — трогать её не нужно, чтобы подкрутить шоу.

// Цвета из палитры приглашения: на льняном фоне яркая радуга выглядит
// чужой, а шалфейная зелень с айвори читается как часть оформления.
export const CONFETTI_COLORS = ['#7C8A6E', '#93A47F', '#C7CEB9', '#E8ECDF', '#FBFAF6']

export const CONFETTI_GRAVITY = 600
export const CONFETTI_DRAG = 0.86

// Угол взлёта снаряда от вертикали (0° — прямо вверх); у каждого
// снаряда свой случайный угол в этом диапазоне.
export const CONFETTI_LAUNCH_ANGLE = { min: 0, max: 10 }

export const CONFETTI_SPARK_COUNT = { min: 54, max: 78 }
export const CONFETTI_RIBBON_COUNT = 16

// Залпы вразнобой: одновременные выстрелы читаются как глитч, а сдвиг
// в полсекунды — как праздник. [время в секундах, летит слева?]
export const CONFETTI_SALVO: Array<[number, boolean]> = [
  [0.15, true], [0.42, false],
  [1.15, true], [1.48, false],
  [2.25, true], [2.40, false],
  [3.00, true], [3.30, false],
  [3.90, true], [3.20, false],
]
