import { defineEventHandler } from 'h3'
import { db } from '../../../database/client'
import { guests, companions } from '../../../database/schema'
import { requireAdminSession } from '../../../utils/session'

export async function listGuests(dbInstance: typeof db = db) {
  const allGuests = dbInstance.select().from(guests).all()
  const allCompanions = dbInstance.select().from(companions).all()

  return allGuests.map((guest) => ({
    ...guest,
    companions: allCompanions.filter((companion) => companion.guestId === guest.id)
  }))
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return listGuests()
})
