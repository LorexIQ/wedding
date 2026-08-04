import { z } from 'zod'
import { DRINK_OPTIONS, isDrinkSetValid } from '../constants/drinks'

const DRINK_CLASH = '«Не пью» нельзя совместить с другими напитками'

const drinksField = z
  .array(z.enum(DRINK_OPTIONS))
  .refine(isDrinkSetValid, DRINK_CLASH)

const phoneField = z.string().trim()
  .regex(/^\+7 \d{3} \d{3}-\d{2}-\d{2}$/, 'Введите телефон полностью или очистите поле')
  .optional()
  .or(z.literal(''))

export const companionSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО сопровождающего').max(200),
  drinks: drinksField.default([])
})

export const rsvpSchema = z.object({
  fio: z.string().trim().min(1, 'Укажите ФИО').max(200),
  phone: phoneField,
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
  attending: z.boolean({
    required_error: 'Укажите, придёте ли вы',
    invalid_type_error: 'Укажите, придёте ли вы'
  }),
  drinks: drinksField.default([]),
  companions: z.array(companionSchema).max(3, 'Не больше 3 сопровождающих').default([]),
  website: z.string().optional().default('')
})

export type RsvpInput = z.infer<typeof rsvpSchema>

export const guestPatchSchema = z.object({
  fio: z.string().trim().max(200).optional(),
  phone: phoneField,
  comment: z.string().trim().max(1000).optional(),
  drinks: drinksField.optional(),
  submitted: z.boolean().optional(),
  envelopeOpened: z.boolean().optional(),
  attending: z.boolean().nullable().optional(),
  allowCompanions: z.boolean().optional()
}).strict()

export type GuestPatchInput = z.infer<typeof guestPatchSchema>

export const guestCreateSchema = z.object({
  fio: z.string().trim().max(200).optional(),
  phone: phoneField,
  comment: z.string().trim().max(1000).optional(),
  drinks: drinksField.optional(),
  attending: z.boolean().nullable().optional(),
  allowCompanions: z.boolean().optional()
}).strict()

export type GuestCreateInput = z.infer<typeof guestCreateSchema>
