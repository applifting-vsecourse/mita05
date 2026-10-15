import { describe, expect, it } from "vitest"

import { applyVote } from "@/features/quack/api/applyVote"
import type { Poll } from "@/features/quack/api/quackSchemas"

const poll = (myVoteOptionId: string | null): Poll => ({
  id: "p1",
  options: [
    { id: "o1", text: "Pizza", voteCount: 3 },
    { id: "o2", text: "Thai", voteCount: 1 },
  ],
  totalVotes: 4,
  myVoteOptionId,
})

const counts = (p: Poll) => p.options.map((option) => option.voteCount)

describe("applyVote", () => {
  it("adds a first vote and grows the total", () => {
    const next = applyVote(poll(null), "o2")

    expect(counts(next)).toEqual([3, 2])
    expect(next.totalVotes).toBe(5)
    expect(next.myVoteOptionId).toBe("o2")
  })

  it("moves a changed vote without changing the total", () => {
    const next = applyVote(poll("o1"), "o2")

    expect(counts(next)).toEqual([2, 2])
    expect(next.totalVotes).toBe(4)
    expect(next.myVoteOptionId).toBe("o2")
  })

  it("leaves the poll alone for the answer you already picked", () => {
    const before = poll("o1")

    expect(applyVote(before, "o1")).toBe(before)
  })

  it("does not change the poll it was given", () => {
    const before = poll("o1")

    applyVote(before, "o2")

    expect(counts(before)).toEqual([3, 1])
    expect(before.myVoteOptionId).toBe("o1")
  })
})
