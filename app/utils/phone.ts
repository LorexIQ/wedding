/** Человекочитаемый вид: 79066951293 → +7 906 695-12-93 */
export function formatPhone(digits: string): string {
  return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
}

/** Маска до клика: 79066951293 → +7 906 •••-••-•• */
export function maskPhone(digits: string): string {
  return `+${digits[0]} ${digits.slice(1, 4)} •••-••-••`
}
