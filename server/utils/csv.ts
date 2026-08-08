import { stringify } from 'csv-stringify/sync'
import { shortFio } from '#shared/utils/shortFio'

interface GuestRow {
  id: number
  fio: string | null
  phone: string | null
  comment: string | null
  drinks: string[]
  companions: { fio: string, drinks: string[] }[]
}

// Prefix a leading =, +, - or @ with a single quote so spreadsheet apps
// (Excel, LibreOffice, Google Sheets) treat the field as plain text instead
// of evaluating it as a formula (CSV formula injection). This is only
// applied to free-text fields a guest could type into (fio, comment, and
// the companions summary, which embeds companion fio values) — NOT to
// phone or drinks, since a bare "+79990000000" can't form a formula/DDE
// payload and the leading quote would just mangle a real phone number.
function neutralizeFormulaInjection(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

export function guestsToCsv(guestRows: GuestRow[]): string {
  const header = ['ID', 'ФИО', 'Телефон', 'Комментарий', 'Напитки', 'Сопровождающие']
  const records = [header]

  for (const guest of guestRows) {
    const companionsText = guest.companions.map((c) => `${shortFio(c.fio)} (${c.drinks.join('; ')})`).join(' | ')
    records.push([
      String(guest.id),
      neutralizeFormulaInjection(shortFio(guest.fio)),
      guest.phone ?? '',
      neutralizeFormulaInjection(guest.comment ?? ''),
      guest.drinks.join('; '),
      neutralizeFormulaInjection(companionsText)
    ])
  }

  // csv-stringify appends record_delimiter after every record (including
  // the last), so trim the trailing newline to keep the existing
  // no-trailing-newline convention that callers/tests rely on.
  return stringify(records, { record_delimiter: '\n' }).replace(/\n$/, '')
}
