import { z } from 'zod'

export const settingsPatchSchema = z.object({
  rsvpDeadlineAt: z.string().min(1).nullable()
}).strict()

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>
