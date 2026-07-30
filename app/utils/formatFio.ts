/** «  иванов   иван » → «Иванов Иван»: схлопывает пробелы, каждое слово
 *  (и часть после дефиса) — с заглавной буквы. Вызывается по blur поля. */
export function formatFio(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.split('-').map(capitalize).join('-'))
    .join(' ')
}

function capitalize(word: string): string {
  if (!word) return word
  return word[0]!.toUpperCase() + word.slice(1).toLowerCase()
}
