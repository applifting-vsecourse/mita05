import { api } from "@/lib/api-client"
import type { QuackMood } from "@/lib/quackMoods"

import { quackSchema, type Quack } from "@/features/quack/api/quackSchemas"

export async function addQuack(input: {
  text: string
  mood?: QuackMood
  /** Only sent for a poll quack; the text is the poll's question. */
  poll?: { options: string[] }
}): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}
