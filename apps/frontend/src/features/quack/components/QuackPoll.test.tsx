import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { pollSchema, type Poll, type Quack } from "@/features/quack/api/quackSchemas"
import { votePoll } from "@/features/quack/api/votePoll"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackPoll, votePercent } from "@/features/quack/components/QuackPoll"
import { VOTE_FAILED_MESSAGE } from "@/features/quack/hooks/useVote"

vi.mock("@/features/quack/api/votePoll", () => ({ votePoll: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

// Voting needs a query client; each test gets a fresh one.
const render = (ui: ReactNode) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

beforeEach(() => {
  vi.mocked(votePoll).mockReset()
  vi.mocked(toast.error).mockReset()
})

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  id: "p1",
  options: [
    { id: "o1", text: "Pizza", voteCount: 3 },
    { id: "o2", text: "Thai", voteCount: 1 },
    { id: "o3", text: "Salad bar", voteCount: 0 },
  ],
  totalVotes: 4,
  myVoteOptionId: null,
  ...overrides,
})

const answer = (text: string) => {
  const item = screen.getByText(text).closest("li")
  if (!item) throw new Error(`No answer "${text}"`)
  return item
}

const barWidth = (text: string) =>
  answer(text).querySelector<HTMLElement>('[data-slot="poll-bar"]')?.style.width

describe("QuackPoll", () => {
  it("shows every answer in order with its count and percentage", () => {
    render(<QuackPoll poll={poll()} />)

    const items = within(screen.getByRole("list", { name: "Poll answers" })).getAllByRole(
      "listitem",
    )
    expect(items.map((item) => item.textContent)).toEqual([
      "Pizza3 votes · 75%",
      "Thai1 vote · 25%",
      "Salad bar0 votes · 0%",
    ])
  })

  it("draws each bar as wide as its share of the votes", () => {
    render(<QuackPoll poll={poll()} />)

    expect(barWidth("Pizza")).toBe("75%")
    expect(barWidth("Thai")).toBe("25%")
    expect(barWidth("Salad bar")).toBe("0%")
  })

  it("shows the total number of votes", () => {
    render(<QuackPoll poll={poll()} />)

    expect(screen.getByText("4 votes")).toBeInTheDocument()
  })

  it("says 1 vote, not 1 votes", () => {
    render(
      <QuackPoll
        poll={poll({
          options: [
            { id: "o1", text: "Pizza", voteCount: 1 },
            { id: "o2", text: "Thai", voteCount: 0 },
          ],
          totalVotes: 1,
        })}
      />,
    )

    expect(within(answer("Pizza")).getByText("1 vote · 100%")).toBeInTheDocument()
    expect(screen.getByText("1 vote", { selector: "p" })).toBeInTheDocument()
  })

  it("shows a poll nobody has voted in yet with empty bars", () => {
    render(
      <QuackPoll
        poll={poll({
          options: [
            { id: "o1", text: "Pizza", voteCount: 0 },
            { id: "o2", text: "Thai", voteCount: 0 },
          ],
          totalVotes: 0,
        })}
      />,
    )

    expect(screen.getByText("No votes yet")).toBeInTheDocument()
    expect(barWidth("Pizza")).toBe("0%")
    expect(barWidth("Thai")).toBe("0%")
  })

  it("marks the answer you picked, and only that one", () => {
    render(<QuackPoll poll={poll({ myVoteOptionId: "o2" })} />)

    expect(within(answer("Thai")).getByText("(your vote)")).toBeInTheDocument()
    expect(screen.getAllByText("(your vote)")).toHaveLength(1)
  })

  it("marks nothing when you haven't voted", () => {
    render(<QuackPoll poll={poll()} />)

    expect(screen.queryByText("(your vote)")).not.toBeInTheDocument()
  })
})

describe("QuackPoll voting", () => {
  it("makes every answer a button, pressed only for your pick", () => {
    render(<QuackPoll poll={poll({ myVoteOptionId: "o1" })} />)

    expect(screen.getByRole("button", { name: /Pizza/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Thai/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: /Salad bar/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("votes for the answer you click", async () => {
    vi.mocked(votePoll).mockReturnValue(new Promise<Poll>(() => undefined))
    render(<QuackPoll poll={poll()} />)

    await userEvent.click(screen.getByRole("button", { name: /Thai/ }))

    expect(votePoll).toHaveBeenCalledExactlyOnceWith({ pollId: "p1", optionId: "o2" })
  })

  it("can switch your vote to another answer", async () => {
    vi.mocked(votePoll).mockReturnValue(new Promise<Poll>(() => undefined))
    render(<QuackPoll poll={poll({ myVoteOptionId: "o1" })} />)

    await userEvent.click(screen.getByRole("button", { name: /Salad bar/ }))

    expect(votePoll).toHaveBeenCalledExactlyOnceWith({ pollId: "p1", optionId: "o3" })
  })

  it("sends nothing when you click the answer you already picked", async () => {
    render(<QuackPoll poll={poll({ myVoteOptionId: "o1" })} />)

    await userEvent.click(screen.getByRole("button", { name: /Pizza/ }))

    expect(votePoll).not.toHaveBeenCalled()
  })
})

// The poll inside a real feed query, so clicks go through the cache like in the app.
describe("QuackPoll in the feed", () => {
  const lunch: Quack = {
    id: "q1",
    text: "Where do we go for lunch?",
    mood: null,
    userId: "u1",
    createdAt: new Date("2026-01-01T12:00:00Z"),
    user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
    poll: poll(),
  }

  // The feed starts in the cache. The refetch after a vote never answers, so
  // what's on screen comes from the vote itself (or its rollback), not a reload.
  const fetchFeed = () => new Promise<Quack[]>(() => undefined)

  function Feed() {
    const { data = [] } = useQuery({
      queryKey: quackKeys.list(""),
      queryFn: fetchFeed,
      staleTime: Infinity,
    })
    return <QuackList quacks={data} />
  }

  const renderFeed = () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(quackKeys.list(""), [lunch])
    return rtlRender(
      <QueryClientProvider client={queryClient}>
        <Feed />
      </QueryClientProvider>,
    )
  }

  it("shows your vote at once, before the server answers", async () => {
    vi.mocked(votePoll).mockReturnValue(new Promise<Poll>(() => undefined))
    renderFeed()

    await userEvent.click(screen.getByRole("button", { name: /Thai/ }))

    expect(answer("Thai")).toHaveTextContent("Thai(your vote)2 votes · 40%")
    expect(answer("Pizza")).toHaveTextContent("Pizza3 votes · 60%")
    expect(screen.getByText("5 votes")).toBeInTheDocument()
  })

  it("puts the poll back and says so when the vote fails", async () => {
    let failVote!: (error: Error) => void
    vi.mocked(votePoll).mockReturnValue(
      new Promise((_, reject) => {
        failVote = reject
      }),
    )
    renderFeed()

    await userEvent.click(screen.getByRole("button", { name: /Thai/ }))
    expect(answer("Thai")).toHaveTextContent("2 votes")

    failVote(new Error("Network down"))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(VOTE_FAILED_MESSAGE))
    expect(answer("Thai")).toHaveTextContent("Thai1 vote · 25%")
    expect(screen.queryByText("(your vote)")).not.toBeInTheDocument()
    expect(screen.getByText("4 votes")).toBeInTheDocument()
  })
})

describe("votePercent", () => {
  it("rounds to whole percent and is 0 without votes", () => {
    expect(votePercent(1, 3)).toBe(33)
    expect(votePercent(2, 3)).toBe(67)
    expect(votePercent(0, 0)).toBe(0)
  })
})

describe("pollSchema", () => {
  it("accepts the poll the API sends", () => {
    expect(pollSchema.parse(poll({ myVoteOptionId: "o1" }))).toEqual(poll({ myVoteOptionId: "o1" }))
  })

  it("rejects a negative count", () => {
    expect(() =>
      pollSchema.parse(poll({ options: [{ id: "o1", text: "Pizza", voteCount: -1 }] })),
    ).toThrow()
  })
})
