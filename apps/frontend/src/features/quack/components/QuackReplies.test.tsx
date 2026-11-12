import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addReply } from "@/features/quack/api/addReply"
import type { LiveQuack, Quack, Reply } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/addReply", () => ({ addReply: vi.fn() }))

const VIEWER_ID = "me"

const reply = (id: string, userId: string, text: string): Reply => ({
  id,
  text,
  userId,
  parentId: "q1",
  createdAt: new Date("2026-01-01T12:05:00Z"),
  user: { id: userId, name: `User ${userId}`, username: userId },
})

const quack = (replies: Reply[] = []): LiveQuack => ({
  id: "q1",
  isDeleted: false,
  text: "Where do we go for lunch?",
  mood: "happy",
  userId: "author",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "author", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  replies,
})

const tombstone = (replies: Reply[]): Quack => ({
  id: "q1",
  isDeleted: true,
  text: null,
  mood: null,
  userId: null,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: null,
  poll: null,
  replies,
})

const renderList = (quacks: Quack[], { isAdmin = false } = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackList
        quacks={quacks}
        viewerId={VIEWER_ID}
        isAdmin={isAdmin}
      />
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.mocked(addReply).mockReset()
})

describe("replies in the feed", () => {
  it("shows replies under their quack, in the order given (oldest first)", () => {
    renderList([quack([reply("r1", "a", "Pizza"), reply("r2", "b", "Thai")])])

    const replies = within(screen.getByRole("list", { name: "Replies" })).getAllByRole("listitem")
    expect(replies.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Pizza"),
      expect.stringContaining("Thai"),
    ])
    expect(screen.getByText("@a")).toBeInTheDocument()
  })

  it("offers Delete on my own replies only, and on every reply for an admin", () => {
    const replies = [reply("r1", VIEWER_ID, "mine"), reply("r2", "someone", "theirs")]
    const { unmount } = renderList([quack(replies)])

    expect(screen.getAllByRole("button", { name: "Delete reply" })).toHaveLength(1)
    unmount()

    renderList([quack(replies)], { isAdmin: true })
    expect(screen.getAllByRole("button", { name: "Delete reply" })).toHaveLength(2)
  })

  it("shows a deleted quack as a placeholder with no author, mood, actions or text", () => {
    renderList([tombstone([reply("r1", "a", "Deleting it won't save you")])], { isAdmin: true })

    const article = screen.getByText("This quack was deleted").closest("article")!
    expect(within(article).getByText("Deleting it won't save you")).toBeInTheDocument()
    expect(within(article).queryByText("Caffeinated Duck")).toBeNull()
    expect(within(article).queryByText("Happy")).toBeNull()
    expect(within(article).queryByRole("button", { name: "Reply" })).toBeNull()
    expect(within(article).queryByRole("button", { name: "Delete quack" })).toBeNull()
  })
})

describe("replying", () => {
  it("opens a text-only form: no mood, no poll", async () => {
    renderList([quack()])

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))

    expect(screen.getByLabelText("Your reply")).toHaveFocus()
    expect(screen.queryByRole("radio")).toBeNull()
    expect(screen.queryByRole("button", { name: "Add poll" })).toBeNull()
  })

  it("asks for text before sending anything", async () => {
    renderList([quack()])

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))
    await userEvent.click(screen.getByRole("button", { name: "Post reply" }))

    expect(await screen.findByText("Write something first")).toBeInTheDocument()
    expect(addReply).not.toHaveBeenCalled()
  })

  it("sends only the text, then closes the form", async () => {
    vi.mocked(addReply).mockResolvedValue(reply("r1", VIEWER_ID, "Pizza"))
    renderList([quack()])

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))
    await userEvent.type(screen.getByLabelText("Your reply"), "Pizza")
    await userEvent.click(screen.getByRole("button", { name: "Post reply" }))

    await waitFor(() =>
      expect(vi.mocked(addReply).mock.calls[0]?.[0]).toEqual({ quackId: "q1", text: "Pizza" }),
    )
    await waitFor(() => expect(screen.queryByLabelText("Your reply")).toBeNull())
  })

  it("keeps the text and shows the error when the reply fails", async () => {
    vi.mocked(addReply).mockRejectedValue(new Error("Quack not found"))
    renderList([quack()])

    await userEvent.click(screen.getByRole("button", { name: "Reply" }))
    await userEvent.type(screen.getByLabelText("Your reply"), "Pizza")
    await userEvent.click(screen.getByRole("button", { name: "Post reply" }))

    expect(await screen.findByText("Quack not found")).toBeInTheDocument()
    expect(screen.getByLabelText("Your reply")).toHaveValue("Pizza")
  })
})
