import { z } from 'zod'
import { DRINK_OPTIONS } from '../constants/drinks'

export const companionSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО сопровождающего').max(200),
  drinks: z.array(z.enum(DRINK_OPTIONS)).default([])
})

export const rsvpSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО').max(200),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  drinks: z.array(z.enum(DRINK_OPTIONS)).default([]),
  companions: z.array(companionSchema).max(3, 'Не больше 3 сопровождающих').default([]),
  website: z.string().optional().default('')
})

export type RsvpInput = z.infer<typeof rsvpSchema>

export const guestPatchSchema = z.object({
  fio: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  comment: z.string().trim().max(1000).optional(),
  drinks: z.array(z.enum(DRINK_OPTIONS)).optional()
}).strict()

export type GuestPatchInput = z.infer<typeof guestPatchSchema>
