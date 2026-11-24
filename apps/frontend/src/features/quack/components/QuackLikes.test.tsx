// Likes in the feed: the frontend cases F1–F7 in docs/features/likes/cases.md.
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { likeQuack, unlikeQuack, type LikeSummary } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { LiveQuack, Quack, Reply } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

vi.mock("@/features/quack/api/likeQuack", () => ({ likeQuack: vi.fn(), unlikeQuack: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const VIEWER_ID = "me"

// The like fields aren't in the zod schemas yet, so fixtures add them on top.
const likes = (likeCount: number, isLikedByMe: boolean): LikeSummary => ({
  likeCount,
  likedByMe: isLikedByMe,
})

const reply = (id: string, summary: LikeSummary): Reply & LikeSummary => ({
  id,
  text: "Pizza",
  userId: "someone",
  parentId: "q1",
  createdAt: new Date("2026-01-01T12:05:00Z"),
  user: { id: "someone", name: "Some Duck", username: "SomeDuck" },
  ...summary,
})

const quack = (summary: LikeSummary, replies: Reply[] = []): LiveQuack & LikeSummary => ({
  id: "q1",
  isDeleted: false,
  text: "Where do we go for lunch?",
  mood: null,
  userId: "author",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "author", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  replies,
  ...summary,
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

// Renders the feed from the query cache, as the feed page does, so an instant
// update to the cache shows on screen.
const renderFeed = (quacks: Quack[]) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(quackKeys.list(""), quacks)
  function Feed() {
    const { data } = useQuery({
      queryKey: quackKeys.list(""),
      queryFn: () => new Promise<Quack[]>(() => undefined),
      enabled: false,
    })
    return (
      <QuackList
        quacks={data ?? []}
        viewerId={VIEWER_ID}
      />
    )
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <Feed />
    </QueryClientProvider>,
  )
}

const likeButton = (container: HTMLElement = document.body) =>
  within(container).getByRole("button", { name: "Like" })

// A request we finish by hand, to look at the screen before the server answers.
const pending = () => new Promise<LikeSummary>(() => undefined)

beforeEach(() => {
  vi.mocked(likeQuack).mockReset()
  vi.mocked(unlikeQuack).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe("likes in the feed", () => {
  it("F1: every quack shows its count, including 0", () => {
    renderFeed([quack(likes(0, false))])

    expect(likeButton()).toHaveTextContent("0")
  })

  it("F2: the button shows whether I liked the quack", () => {
    const { unmount } = renderFeed([quack(likes(3, true))])
    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    unmount()

    renderFeed([quack(likes(3, false))])
    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
  })

  it("F3: clicking updates the count and the button before the server answers", async () => {
    vi.mocked(likeQuack).mockReturnValue(pending())
    renderFeed([quack(likes(0, false))])

    await userEvent.click(likeButton())

    expect(likeButton()).toHaveTextContent("1")
    expect(likeButton()).toHaveAttribute("aria-pressed", "true")
    expect(likeQuack).toHaveBeenCalledWith("q1")
  })

  it("F4: clicking a quack I liked takes the like back", async () => {
    vi.mocked(unlikeQuack).mockReturnValue(pending())
    renderFeed([quack(likes(1, true))])

    await userEvent.click(likeButton())

    expect(likeButton()).toHaveTextContent("0")
    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
    expect(unlikeQuack).toHaveBeenCalledWith("q1")
    expect(likeQuack).not.toHaveBeenCalled()
  })

  it("F5: a refused request rolls back and shows an error", async () => {
    vi.mocked(likeQuack).mockRejectedValue(new Error("Quack not found"))
    renderFeed([quack(likes(0, false))])

    await userEvent.click(likeButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(likeButton()).toHaveTextContent("0")
    expect(likeButton()).toHaveAttribute("aria-pressed", "false")
  })

  it("F6: replies have their own like button", () => {
    renderFeed([quack(likes(0, false), [reply("r1", likes(2, false))])])

    const replies = screen.getByRole("list", { name: "Replies" })
    expect(likeButton(replies)).toHaveTextContent("2")
    expect(screen.getAllByRole("button", { name: "Like" })).toHaveLength(2)
  })

  it("F7: a tombstone has no like button, but its replies do", () => {
    renderFeed([tombstone([reply("r1", likes(1, false))])])

    const article = screen.getByText("This quack was deleted").closest("article")!
    const replies = within(article).getByRole("list", { name: "Replies" })
    // the only Like button is the reply's
    expect(within(article).getAllByRole("button", { name: "Like" })).toEqual([likeButton(replies)])
  })
})
