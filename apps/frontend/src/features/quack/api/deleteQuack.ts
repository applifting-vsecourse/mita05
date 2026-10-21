import { api } from "@/lib/api-client"

/** Deletes one of the signed-in user's quacks; the server refuses anyone else's. */
export async function deleteQuack(quackId: string): Promise<void> {
  await api.delete(`quacks/${encodeURIComponent(quackId)}`)
}
