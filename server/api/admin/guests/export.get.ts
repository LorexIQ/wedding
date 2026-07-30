import { defineEventHandler, setResponseHeader } from 'h3'
import { requireAdminSession } from '../../../utils/session'
import { listGuests } from './index.get'
import { guestsToCsv } from '../../../utils/csv'

const UTF8_BOM = String.fromCharCode(0xfeff)

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const guestRows = await listGuests()
  const csv = guestsToCsv(guestRows)

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="guests.csv"')
  // Prepend a UTF-8 BOM so Excel detects the encoding and renders Cyrillic
  // text correctly instead of mojibake. This is an HTTP-transport concern,
  // not a CSV-formatting concern, so it's added here rather than in
  // guestsToCsv (whose tests assert exact string equality without a BOM).
  return `${UTF8_BOM}${csv}`
})
