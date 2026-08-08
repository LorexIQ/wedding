/** Display-only: trims a stored ФИО down to "Имя Фамилия" (first two words),
 *  matching what the RSVP form actually collects. Never mutates stored data. */
export function shortFio(fio: string | null | undefined): string {
  if (!fio) return ''
  return fio.trim().split(/\s+/).slice(0, 2).join(' ')
}
