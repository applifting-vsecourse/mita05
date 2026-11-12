import { api } from "@/lib/api-client"

/**
 * Deletes one of the signed-in user's quacks or replies; the server refuses anyone
 * else's (admins excepted). A quack with replies stays as a placeholder.
 */
export async function deleteQuack(quackId: string): Promise<void> {
  await api.delete(`quacks/${encodeURIComponent(quackId)}`)
}
