/** A quack's likes as the signed-in user sees them. See docs/adr/0002-likes.md. */
export type LikeSummary = { likeCount: number; likedByMe: boolean }

/** Likes a quack or reply as the signed-in user. Liking twice changes nothing. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function likeQuack(quackId: string): Promise<LikeSummary> {
  throw new Error("not implemented")
}

/** Takes back the signed-in user's like. Unliking when not liked changes nothing. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function unlikeQuack(quackId: string): Promise<LikeSummary> {
  throw new Error("not implemented")
}
