import type { LikeSummary } from "@/features/quack/api/likeQuack"
import type { Quack } from "@/features/quack/api/quackSchemas"

/** The likes as they will look once the user's like (or unlike) lands. */
export function applyLike(likes: LikeSummary, isLiked: boolean): LikeSummary {
  if (likes.likedByMe === isLiked) return likes
  return {
    likeCount: Math.max(0, likes.likeCount + (isLiked ? 1 : -1)),
    likedByMe: isLiked,
  }
}

/**
 * Updates the likes of the quack or reply with that id, wherever it is in the
 * feed. A tombstone has no likes, so it is never touched.
 */
export function applyLikesInFeed(
  quacks: Quack[],
  quackId: string,
  update: (likes: LikeSummary) => LikeSummary,
): Quack[] {
  const updateItem = <T extends Partial<LikeSummary>>(item: T): T =>
    item.likeCount === undefined || item.likedByMe === undefined
      ? item
      : { ...item, ...update({ likeCount: item.likeCount, likedByMe: item.likedByMe }) }

  return quacks.map((quack) => {
    const withReplies = quack.replies.some((reply) => reply.id === quackId)
      ? {
          ...quack,
          replies: quack.replies.map((reply) => (reply.id === quackId ? updateItem(reply) : reply)),
        }
      : quack
    return withReplies.id === quackId && !withReplies.isDeleted
      ? updateItem(withReplies)
      : withReplies
  })
}
