// Example component test — the pattern to copy for your own components.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  ...overrides,
})

describe("QuackList", () => {
  it("renders quacks with author info", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it("shows the mood of a quack that has one", () => {
    render(<QuackList quacks={[quack({ mood: "silly" })]} />)

    expect(screen.getByText("Silly")).toBeInTheDocument()
  })

  it("shows no mood for a quack without one", () => {
    render(<QuackList quacks={[quack()]} />)

    for (const label of ["Happy", "Sad", "Angry", "Silly"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("says nothing matched a search, with a working clear button", async () => {
    const onClearSearch = vi.fn()
    render(
      <QuackList
        quacks={[]}
        search="xyz"
        onClearSearch={onClearSearch}
      />,
    )

    expect(screen.getByText("No quacks match 'xyz'.")).toBeInTheDocument()
    expect(screen.queryByText(/no quacks yet/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onClearSearch).toHaveBeenCalledOnce()
  })

  it("shows the poll of a quack that has one, under its text", () => {
    // A poll can be voted in, which needs a query client.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <QuackList
          quacks={[
            quack({
              text: "Where do we go for lunch?",
              poll: {
                id: "p1",
                options: [
                  { id: "o1", text: "Pizza", voteCount: 1 },
                  { id: "o2", text: "Thai", voteCount: 0 },
                ],
                totalVotes: 1,
                myVoteOptionId: null,
              },
            }),
          ]}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText("Where do we go for lunch?")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Poll answers" })).toBeInTheDocument()
    expect(screen.getByText("Pizza")).toBeInTheDocument()
  })

  it("shows no poll for a quack without one", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.queryByRole("list", { name: "Poll answers" })).not.toBeInTheDocument()
    expect(screen.queryByText("No votes yet")).not.toBeInTheDocument()
  })

  it("shows the regular empty state without a search", () => {
    render(<QuackList quacks={[]} />)

    expect(screen.getByText("No quacks yet. Post the first one.")).toBeInTheDocument()
  })

  it("invites me to write my first quack when Mine is empty", async () => {
    const onWriteFirstQuack = vi.fn()
    render(
      <QuackList
        quacks={[]}
        isMine
        onWriteFirstQuack={onWriteFirstQuack}
      />,
    )

    expect(screen.getByText("You haven't posted any quacks yet.")).toBeInTheDocument()
    expect(screen.queryByText(/no quacks yet/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Write your first quack" }))
    expect(onWriteFirstQuack).toHaveBeenCalledOnce()
  })

  it("says a search found nothing, even in Mine", () => {
    render(
      <QuackList
        quacks={[]}
        isMine
        search="xyz"
      />,
    )

    expect(screen.getByText("No quacks match 'xyz'.")).toBeInTheDocument()
    expect(screen.queryByText("You haven't posted any quacks yet.")).not.toBeInTheDocument()
  })

  it("shows an error with a working reload button", async () => {
    const onReload = vi.fn()
    render(
      <QuackList
        quacks={[]}
        error={new Error("Server unreachable")}
        onReload={onReload}
      />,
    )

    expect(screen.getByText("Couldn't load quacks")).toBeInTheDocument()
    expect(screen.getByText("Server unreachable")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
