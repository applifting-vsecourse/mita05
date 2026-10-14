import { z } from "zod"

import { quackMoodSchema } from "@/lib/quackMoods"

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  bio: z.string().nullable(),
  defaultMood: quackMoodSchema.nullable(),
})

export type Profile = z.infer<typeof profileSchema>

export type ProfileUpdate = Omit<Profile, "id">
