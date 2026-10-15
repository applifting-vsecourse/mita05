import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

/** Sets the signed-in user's vote and returns the poll with the server's counts. */
export async function votePoll(input: { pollId: string; optionId: string }): Promise<Poll> {
  const json = await api
    .put(`polls/${encodeURIComponent(input.pollId)}/vote`, { json: { optionId: input.optionId } })
    .json()
  return pollSchema.parse(json)
}
