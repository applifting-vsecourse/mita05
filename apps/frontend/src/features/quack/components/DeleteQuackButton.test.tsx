import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/deleteQuack", () => ({ deleteQuack: vi.fn() }))

beforeEach(() => {
  vi.mocked(deleteQuack).mockReset()
})

const VIEWER_ID = "me"

const quack = (id: string, userId: string, text: string): Quack => ({
  id,
  text,
  mood: null,
  userId,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: userId, name: `User ${userId}`, username: userId },
  poll: null,
})

const mine = quack("q1", VIEWER_ID, "my quack")
const theirs = quack("q2", "someone-else", "their quack")

// The feed starts in the cache. The refetch after a delete never answers, so
// what's on screen comes from the delete itself, not a reload.
const fetchFeed = () => new Promise<Quack[]>(() => undefined)

function Feed({ isMine = false, isAdmin = false }: { isMine?: boolean; isAdmin?: boolean }) {
  const { data = [] } = useQuery({
    queryKey: quackKeys.list("", isMine),
    queryFn: fetchFeed,
    staleTime: Infinity,
  })
  return (
    <QuackList
      quacks={data}
      viewerId={VIEWER_ID}
      isAdmin={isAdmin}
    />
  )
}

const renderFeed = ({ isAdmin = false }: { isAdmin?: boolean } = {}) => {
  const queryClient = new QueryClient()
  // The same quack cached in the All and the Mine feed.
  queryClient.setQueryData(quackKeys.list(""), [mine, theirs])
  queryClient.setQueryData(quackKeys.list("", true), [mine])
  render(
    <QueryClientProvider client={queryClient}>
      <Feed isAdmin={isAdmin} />
    </QueryClientProvider>,
  )
  return queryClient
}

const openDialog = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
  return screen.getByRole("alertdialog", { name: "Delete this quack?" })
}

describe("deleting a quack", () => {
  it("offers Delete on my quacks only", () => {
    renderFeed()

    expect(screen.getAllByRole("button", { name: "Delete quack" })).toHaveLength(1)
    const myQuack = screen.getByText("my quack").closest("article")
    const theirQuack = screen.getByText("their quack").closest("article")
    expect(within(myQuack!).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
    expect(within(theirQuack!).queryByRole("button", { name: "Delete quack" })).toBeNull()
  })

  it("offers an admin Delete on everyone's quacks", () => {
    renderFeed({ isAdmin: true })

    const theirQuack = screen.getByText("their quack").closest("article")
    expect(within(theirQuack!).getByRole("button", { name: "Delete quack" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Delete quack" })).toHaveLength(2)
  })

  it("lets an admin delete someone else's quack with the same dialog", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    renderFeed({ isAdmin: true })

    const theirQuack = screen.getByText("their quack").closest("article")
    await userEvent.click(within(theirQuack!).getByRole("button", { name: "Delete quack" }))
    const dialog = screen.getByRole("alertdialog", { name: "Delete this quack?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.queryByText("their quack")).not.toBeInTheDocument())
    expect(vi.mocked(deleteQuack).mock.calls[0]?.[0]).toBe("q2")
    expect(screen.getByText("my quack")).toBeInTheDocument()
  })

  it("offers no Delete when the viewer is unknown", () => {
    render(<QuackList quacks={[mine]} />)

    expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  })

  it("asks first, and cancelling keeps the quack", async () => {
    renderFeed()

    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(deleteQuack).not.toHaveBeenCalled()
    expect(screen.getByText("my quack")).toBeInTheDocument()
  })

  it("removes the quack from every feed once confirmed", async () => {
    vi.mocked(deleteQuack).mockResolvedValue()
    const queryClient = renderFeed()

    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.queryByText("my quack")).not.toBeInTheDocument())
    expect(vi.mocked(deleteQuack).mock.calls[0]?.[0]).toBe("q1")
    expect(screen.getByText("their quack")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(queryClient.getQueryData(quackKeys.list("", true))).toEqual([])
  })

  it("keeps the dialog open while deleting", async () => {
    vi.mocked(deleteQuack).mockReturnValue(new Promise<void>(() => undefined))
    renderFeed()

    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
  })

  it("shows why it failed and keeps the quack", async () => {
    vi.mocked(deleteQuack).mockRejectedValue(new Error("You can only delete your own quacks"))
    renderFeed()

    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(
      await within(dialog).findByText("You can only delete your own quacks"),
    ).toBeInTheDocument()
    expect(screen.getByText("my quack")).toBeInTheDocument()
  })
})
