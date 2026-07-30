import { randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Секрет в ссылке /invite/<код>. Гость его не выбирает, только видит. */
export function generateInviteCode(length = 10): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return code
}
