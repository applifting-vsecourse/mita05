import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"
import { QuackPoll, votePercent } from "@/features/quack/components/QuackPoll"

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
