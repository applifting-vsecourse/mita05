import { describe, expect, it } from "vitest"

import { applyLike, applyLikesInFeed } from "@/features/quack/api/applyLikes"
import type { LiveQuack, Quack, Reply } from "@/features/quack/api/quackSchemas"

const reply = (id: string, likeCount: number): Reply => ({
  id,
  text: "Pizza",
  userId: "u2",
  parentId: "q1",
  createdAt: new Date("2026-01-01T12:05:00Z"),
  user: { id: "u2", name: "Some Duck", username: "SomeDuck" },
  likeCount,
  likedByMe: false,
})

const live = (id: string, likeCount: number, replies: Reply[] = []): LiveQuack => ({
  id,
  isDeleted: false,
  text: "Lunch?",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  replies,
  likeCount,
  likedByMe: false,
})

describe("applyLike", () => {
  it("adds and takes back the viewer's like", () => {
    expect(applyLike({ likeCount: 2, likedByMe: false }, true)).toEqual({
      likeCount: 3,
      likedByMe: true,
    })
    expect(applyLike({ likeCount: 3, likedByMe: true }, false)).toEqual({
      likeCount: 2,
      likedByMe: false,
    })
  })

  it("changes nothing when the like is already in that state", () => {
    const likes = { likeCount: 1, likedByMe: true }
    expect(applyLike(likes, true)).toBe(likes)
  })
})

describe("applyLikesInFeed", () => {
  it("updates only the quack or reply with that id", () => {
    const feed: Quack[] = [live("q1", 0, [reply("r1", 2)]), live("q2", 5)]
    const like = () => ({ likeCount: 9, likedByMe: true })

    const [q1, q2] = applyLikesInFeed(feed, "r1", like)

    expect(q1).toMatchObject({ likeCount: 0, likedByMe: false })
    expect(q1?.replies[0]).toMatchObject({ likeCount: 9, likedByMe: true })
    expect(q2).toBe(feed[1])
  })

  it("never gives a tombstone likes", () => {
    const tombstone: Quack = {
      id: "q1",
      isDeleted: true,
      text: null,
      mood: null,
      userId: null,
      createdAt: new Date("2026-01-01T12:00:00Z"),
      user: null,
      poll: null,
      replies: [reply("r1", 0)],
    }

    const [result] = applyLikesInFeed([tombstone], "q1", () => ({ likeCount: 1, likedByMe: true }))

    expect(result).not.toHaveProperty("likeCount")
  })
})
