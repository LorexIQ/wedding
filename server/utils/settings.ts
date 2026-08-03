import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { settings } from '../database/schema'

const SETTINGS_ROW_ID = 1

export function getRsvpDeadline(dbInstance: typeof db = db): Date | null {
  const row = dbInstance.select().from(settings).where(eq(settings.id, SETTINGS_ROW_ID)).get()
  return row?.rsvpDeadlineAt ?? null
}

export function setRsvpDeadline(value: Date | null, dbInstance: typeof db = db): void {
  dbInstance
    .insert(settings)
    .values({ id: SETTINGS_ROW_ID, rsvpDeadlineAt: value })
    .onConflictDoUpdate({ target: settings.id, set: { rsvpDeadlineAt: value } })
    .run()
}
