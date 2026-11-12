import { describe, expect, it } from "vitest"

import { applyDeletion } from "@/features/quack/api/applyDeletion"
import type { LiveQuack, Quack, Reply } from "@/features/quack/api/quackSchemas"

const reply = (id: string, parentId: string): Reply => ({
  id,
  text: `reply ${id}`,
  userId: "u2",
  parentId,
  createdAt: new Date("2026-01-01T12:05:00Z"),
  user: { id: "u2", name: "Bread Critic", username: "BreadCritic" },
})

const live = (id: string, replies: Reply[] = []): LiveQuack => ({
  id,
  isDeleted: false,
  text: `quack ${id}`,
  mood: "angry",
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  replies,
})

const tombstone = (id: string, replies: Reply[]): Quack => ({
  id,
  isDeleted: true,
  text: null,
  mood: null,
  userId: null,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: null,
  poll: null,
  replies,
})

describe("applyDeletion", () => {
  it("removes a quack without replies", () => {
    expect(applyDeletion([live("q1"), live("q2")], "q1")).toEqual([live("q2")])
  })

  it("turns a quack with replies into a placeholder with no content or author", () => {
    const replies = [reply("r1", "q1")]

    expect(applyDeletion([live("q1", replies)], "q1")).toEqual([tombstone("q1", replies)])
  })

  it("removes a reply and keeps its quack", () => {
    expect(applyDeletion([live("q1", [reply("r1", "q1"), reply("r2", "q1")])], "r1")).toEqual([
      live("q1", [reply("r2", "q1")]),
    ])
  })

  it("removes a placeholder together with its last reply", () => {
    expect(applyDeletion([tombstone("q1", [reply("r1", "q1")]), live("q2")], "r1")).toEqual([
      live("q2"),
    ])
  })

  it("keeps a placeholder that still has replies", () => {
    const left = reply("r2", "q1")

    expect(applyDeletion([tombstone("q1", [reply("r1", "q1"), left])], "r1")).toEqual([
      tombstone("q1", [left]),
    ])
  })

  it("leaves the feed alone for an id it doesn't hold", () => {
    const feed = [live("q1", [reply("r1", "q1")])]

    expect(applyDeletion(feed, "nope")).toEqual(feed)
  })
})
