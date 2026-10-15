import { z } from "zod"

import { quackMoodSchema } from "@/lib/quackMoods"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const pollOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  voteCount: z.number().int().nonnegative(),
})

// Counts are for everyone; myVoteOptionId is only ever the signed-in user's own pick.
export const pollSchema = z.object({
  id: z.string(),
  options: z.array(pollOptionSchema),
  totalVotes: z.number().int().nonnegative(),
  myVoteOptionId: z.string().nullable(),
})

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
export type Poll = z.infer<typeof pollSchema>
