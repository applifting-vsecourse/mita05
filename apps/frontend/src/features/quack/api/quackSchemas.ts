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

// A quack's likes as the signed-in user sees them. The count is for everyone;
// likedByMe is only ever the signed-in user's own like. See docs/adr/0002-likes.md.
export const likeSummarySchema = z.object({
  likeCount: z.number().int().nonnegative(),
  likedByMe: z.boolean(),
})

// The server always sends likes on a live quack or a reply. They're optional
// so a quack built on the client (such as the landing page's samples) can
// leave them out; it then shows no Like button.
const likeFields = likeSummarySchema.partial().shape

// Replies are text only and one level deep.
export const replySchema = z.object({
  id: z.string(),
  text: z.string(),
  userId: z.string(),
  parentId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  ...likeFields,
})

const liveQuackSchema = z.object({
  id: z.string(),
  isDeleted: z.literal(false),
  text: z.string(),
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  poll: pollSchema.nullable(),
  replies: z.array(replySchema),
  ...likeFields,
})

// A deleted quack kept only as a placeholder for its replies. The server erased
// its text, mood, poll and likes and never sends its author.
const deletedQuackSchema = z.object({
  id: z.string(),
  isDeleted: z.literal(true),
  text: z.null(),
  mood: z.null(),
  userId: z.null(),
  createdAt: z.coerce.date(),
  user: z.null(),
  poll: z.null(),
  replies: z.array(replySchema),
})

export const quackSchema = z.discriminatedUnion("isDeleted", [liveQuackSchema, deletedQuackSchema])

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
export type LiveQuack = z.infer<typeof liveQuackSchema>
export type Reply = z.infer<typeof replySchema>
export type Poll = z.infer<typeof pollSchema>
export type LikeSummary = z.infer<typeof likeSummarySchema>
