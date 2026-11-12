import { api } from "@/lib/api-client"

import { replySchema, type Reply } from "@/features/quack/api/quackSchemas"

/** Replies to a quack in the feed. Text only: the server refuses a mood or a poll. */
export async function addReply(input: { quackId: string; text: string }): Promise<Reply> {
  const json = await api
    .post(`quacks/${encodeURIComponent(input.quackId)}/replies`, { json: { text: input.text } })
    .json()
  return replySchema.parse(json)
}
