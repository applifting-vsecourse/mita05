import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { votePoll } from "@/features/quack/api/votePoll"
import { useVote, VOTE_FAILED_MESSAGE } from "@/features/quack/hooks/useVote"

vi.mock("@/features/quack/api/votePoll", () => ({ votePoll: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const pizza = { id: "o1", text: "Pizza" }
const thai = { id: "o2", text: "Thai" }

const before: Poll = {
  id: "p1",
  options: [
    { ...pizza, voteCount: 3 },
    { ...thai, voteCount: 1 },
  ],
  totalVotes: 4,
  myVoteOptionId: null,
}

const quack = (id: string, poll: Poll | null): Quack => ({
  id,
  text: "Where do we go for lunch?",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll,
})

// A request we finish by hand, to control when (and in which order) the server answers.
const deferred = () => {
  let resolve!: (poll: Poll) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Poll>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const setup = () => {
  const queryClient = new QueryClient()
  // The same poll cached in two feeds: the plain one and a search.
  for (const search of ["", "lunch"]) {
    queryClient.setQueryData(quackKeys.list(search), [quack("q1", before), quack("q2", null)])
  }
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useVote("p1"), { wrapper })
  const pollIn = (search: string) =>
    queryClient.getQueryData<Quack[]>(quackKeys.list(search))?.find((q) => q.id === "q1")?.poll
  const vote = (optionId: string) => act(() => result.current.mutate(optionId))
  return { queryClient, invalidate, pollIn, vote }
}

beforeEach(() => {
  vi.mocked(votePoll).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe("useVote", () => {
  it("shows the vote in every cached feed before the server answers", async () => {
    vi.mocked(votePoll).mockReturnValue(deferred().promise)
    const { pollIn, vote, queryClient } = setup()

    vote("o2")

    for (const search of ["", "lunch"]) {
      await waitFor(() => expect(pollIn(search)?.myVoteOptionId).toBe("o2"))
      expect(pollIn(search)?.options.map((o) => o.voteCount)).toEqual([3, 2])
      expect(pollIn(search)?.totalVotes).toBe(5)
    }
    expect(votePoll).toHaveBeenCalledExactlyOnceWith({ pollId: "p1", optionId: "o2" })
    // Other quacks are left alone.
    expect(queryClient.getQueryData<Quack[]>(quackKeys.list(""))?.[1]).toEqual(quack("q2", null))
  })

  it("puts every feed back and shows an error when the vote fails", async () => {
    vi.mocked(votePoll).mockRejectedValue(new Error("Network down"))
    const { pollIn, vote } = setup()

    vote("o2")

    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(VOTE_FAILED_MESSAGE))
    expect(pollIn("")).toEqual(before)
    expect(pollIn("lunch")).toEqual(before)
  })

  it("replaces the guess with the server's counts, then refetches the feed", async () => {
    // Someone else voted Pizza meanwhile; the server's numbers win.
    const fromServer: Poll = {
      ...before,
      options: [
        { id: "o1", text: "Pizza", voteCount: 4 },
        { id: "o2", text: "Thai", voteCount: 2 },
      ],
      totalVotes: 6,
      myVoteOptionId: "o2",
    }
    vi.mocked(votePoll).mockResolvedValue(fromServer)
    const { pollIn, vote, invalidate } = setup()

    vote("o2")

    await waitFor(() => expect(invalidate).toHaveBeenCalledOnce())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: quackKeys.all() })
    expect(pollIn("")).toEqual(fromServer)
    expect(pollIn("lunch")).toEqual(fromServer)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("sends one poll's votes one at a time, in click order, and the last click wins", async () => {
    const first = deferred()
    const second = deferred()
    vi.mocked(votePoll).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { pollIn, vote, invalidate } = setup()

    vote("o1")
    vote("o2")

    // Both clicks show at once; only the first request has gone out.
    await waitFor(() => expect(pollIn("")?.myVoteOptionId).toBe("o2"))
    expect(pollIn("")?.options.map((o) => o.voteCount)).toEqual([3, 2])
    expect(votePoll).toHaveBeenCalledTimes(1)
    expect(votePoll).toHaveBeenLastCalledWith({ pollId: "p1", optionId: "o1" })

    // The first answer arrives: the second request goes out, and the screen keeps the later click.
    first.resolve({
      ...before,
      options: [
        { ...pizza, voteCount: 4 },
        { ...thai, voteCount: 1 },
      ],
      totalVotes: 5,
      myVoteOptionId: "o1",
    })
    await waitFor(() => expect(votePoll).toHaveBeenCalledTimes(2))
    expect(votePoll).toHaveBeenLastCalledWith({ pollId: "p1", optionId: "o2" })
    expect(pollIn("")?.myVoteOptionId).toBe("o2")
    expect(invalidate).not.toHaveBeenCalled()

    const final: Poll = {
      ...before,
      options: [
        { ...pizza, voteCount: 3 },
        { ...thai, voteCount: 2 },
      ],
      totalVotes: 5,
      myVoteOptionId: "o2",
    }
    second.resolve(final)
    await waitFor(() => expect(invalidate).toHaveBeenCalledOnce())
    expect(pollIn("")).toEqual(final)
  })

  it("falls back to the earlier vote when a later one fails", async () => {
    const first = deferred()
    const second = deferred()
    vi.mocked(votePoll).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { pollIn, vote } = setup()

    vote("o1")
    vote("o2")
    await waitFor(() => expect(pollIn("")?.myVoteOptionId).toBe("o2"))

    first.resolve({ ...before, myVoteOptionId: "o1" })
    await waitFor(() => expect(votePoll).toHaveBeenCalledTimes(2))
    second.reject(new Error("Network down"))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(VOTE_FAILED_MESSAGE))
    expect(pollIn("")?.myVoteOptionId).toBe("o1")
    expect(pollIn("")?.options.map((o) => o.voteCount)).toEqual([4, 1])
  })
})
