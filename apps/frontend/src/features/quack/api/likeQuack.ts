import { api } from "@/lib/api-client"

import { likeSummarySchema, type LikeSummary } from "@/features/quack/api/quackSchemas"

export type { LikeSummary }

/** Likes a quack or reply as the signed-in user. Liking twice changes nothing. */
export async function likeQuack(quackId: string): Promise<LikeSummary> {
  const json = await api.put(`quacks/${encodeURIComponent(quackId)}/like`).json()
  return likeSummarySchema.parse(json)
}

/** Takes back the signed-in user's like. Unliking when not liked changes nothing. */
export async function unlikeQuack(quackId: string): Promise<LikeSummary> {
  const json = await api.delete(`quacks/${encodeURIComponent(quackId)}/like`).json()
  return likeSummarySchema.parse(json)
}
