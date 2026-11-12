import type { Quack } from "@/features/quack/api/quackSchemas"

/**
 * The feed as it will look once `deletedId` is deleted, mirroring the server
 * (docs/adr/0001-deleted-quacks-become-tombstones.md):
 * - a quack without replies disappears;
 * - a quack with replies becomes a placeholder, its content and author gone;
 * - a reply disappears, and a placeholder left without replies goes with it.
 * The server's answer replaces this when the list refetches.
 */
export function applyDeletion(quacks: Quack[], deletedId: string): Quack[] {
  return quacks.flatMap((quack): Quack[] => {
    if (quack.id === deletedId) {
      if (quack.replies.length === 0) return []
      return [
        {
          id: quack.id,
          isDeleted: true,
          text: null,
          mood: null,
          userId: null,
          createdAt: quack.createdAt,
          user: null,
          poll: null,
          replies: quack.replies,
        },
      ]
    }

    if (!quack.replies.some((reply) => reply.id === deletedId)) return [quack]

    const replies = quack.replies.filter((reply) => reply.id !== deletedId)
    if (quack.isDeleted && replies.length === 0) return []
    return [{ ...quack, replies }]
  })
}
