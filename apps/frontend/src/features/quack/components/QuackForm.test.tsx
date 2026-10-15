import type { ComponentProps } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))

const renderForm = (props: ComponentProps<typeof QuackForm> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm {...props} />
    </QueryClientProvider>,
  )

describe("QuackForm", () => {
  beforeEach(() => {
    vi.mocked(addQuack).mockReset()
  })

  it("posts without a mood when none is picked", async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText("New quack"), "hello")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() =>
      expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "hello", mood: undefined }),
    )
  })

  it("posts the picked mood", async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText("New quack"), "hello")
    await userEvent.click(screen.getByRole("radio", { name: "Angry" }))
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() =>
      expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "hello", mood: "angry" }),
    )
  })

  it("clears the mood when the picked one is clicked again", async () => {
    renderForm()

    const happy = screen.getByRole("radio", { name: "Happy" })
    await userEvent.click(happy)
    expect(happy).toHaveAttribute("aria-checked", "true")

    await userEvent.click(happy)
    expect(happy).toHaveAttribute("aria-checked", "false")
  })
  it("starts with the default mood selected, and again after posting", async () => {
    vi.mocked(addQuack).mockResolvedValue({} as Awaited<ReturnType<typeof addQuack>>)
    renderForm({ defaultMood: "sad" })

    expect(screen.getByRole("radio", { name: "Sad" })).toHaveAttribute("aria-checked", "true")

    await userEvent.type(screen.getByLabelText("New quack"), "hello")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() =>
      expect(vi.mocked(addQuack).mock.calls[0]?.[0]).toEqual({ text: "hello", mood: "sad" }),
    )
    await waitFor(() => expect(screen.getByLabelText("New quack")).toHaveValue(""))
    expect(screen.getByRole("radio", { name: "Sad" })).toHaveAttribute("aria-checked", "true")
  })

  describe("poll", () => {
    const answer = (n: number) => screen.getByLabelText(`Answer ${n}`)
    const quack = () => userEvent.click(screen.getByRole("button", { name: "Quack" }))
    const sent = () => vi.mocked(addQuack).mock.calls[0]?.[0]

    const writePoll = async (question: string, answers: string[]) => {
      await userEvent.type(screen.getByLabelText("New quack"), question)
      await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
      for (const [index, text] of answers.entries()) {
        if (index >= 2) await userEvent.click(screen.getByRole("button", { name: "Add answer" }))
        await userEvent.type(answer(index + 1), text)
      }
    }

    it("starts without a poll", () => {
      renderForm()

      expect(screen.getByRole("button", { name: "Add poll" })).toBeInTheDocument()
      expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument()
    })

    it("adds a poll with two labelled answers that can't be removed", async () => {
      renderForm()

      await userEvent.click(screen.getByRole("button", { name: "Add poll" }))

      expect(answer(1)).toHaveValue("")
      expect(answer(2)).toHaveValue("")
      expect(screen.queryByLabelText("Answer 3")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Remove answer/ })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Remove poll" })).toBeInTheDocument()
    })

    it("allows up to four answers", async () => {
      renderForm()
      await userEvent.click(screen.getByRole("button", { name: "Add poll" }))

      await userEvent.click(screen.getByRole("button", { name: "Add answer" }))
      await userEvent.click(screen.getByRole("button", { name: "Add answer" }))

      expect(answer(4)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Add answer" })).not.toBeInTheDocument()
      for (const n of [1, 2, 3, 4]) {
        expect(screen.getByRole("button", { name: `Remove answer ${n}` })).toBeInTheDocument()
      }
    })

    it("removes an answer, keeping the others, but never below two", async () => {
      renderForm()
      await writePoll("Lunch?", ["Pizza", "Thai", "Salad bar"])

      await userEvent.click(screen.getByRole("button", { name: "Remove answer 2" }))

      expect(answer(1)).toHaveValue("Pizza")
      expect(answer(2)).toHaveValue("Salad bar")
      expect(screen.queryByLabelText("Answer 3")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Remove answer/ })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Add answer" })).toBeInTheDocument()
    })

    it("posts the question with trimmed answers in order, and a mood", async () => {
      vi.mocked(addQuack).mockResolvedValue({} as Awaited<ReturnType<typeof addQuack>>)
      renderForm()
      await writePoll("Where do we go for lunch?", ["  Pizza ", "Thai", "Salad bar"])
      await userEvent.click(screen.getByRole("radio", { name: "Happy" }))

      await quack()

      await waitFor(() =>
        expect(sent()).toEqual({
          text: "Where do we go for lunch?",
          mood: "happy",
          poll: { options: ["Pizza", "Thai", "Salad bar"] },
        }),
      )
    })

    it("sends no poll at all without one", async () => {
      renderForm()

      await userEvent.type(screen.getByLabelText("New quack"), "hello")
      await quack()

      await waitFor(() => expect(addQuack).toHaveBeenCalledOnce())
      expect(sent()).not.toHaveProperty("poll")
    })

    it("sends no poll after the poll is removed", async () => {
      renderForm()
      await writePoll("Lunch?", ["Pizza", "Thai"])

      await userEvent.click(screen.getByRole("button", { name: "Remove poll" }))
      await quack()

      await waitFor(() => expect(addQuack).toHaveBeenCalledOnce())
      expect(sent()).not.toHaveProperty("poll")
      expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument()
    })

    it.each([
      ["an empty answer", "", "Write an answer"],
      ["an answer of only spaces", "   ", "Write an answer"],
      ["an answer over 80 characters", "a".repeat(81), "Keep answers under 80 characters"],
      ["a repeat ignoring case and spaces", "  pizza ", "This answer is already in the poll"],
    ])("rejects %s, with the message under that field", async (_, second, message) => {
      renderForm()
      await writePoll("Lunch?", ["Pizza"])
      if (second) {
        await userEvent.click(answer(2))
        await userEvent.paste(second)
      }

      await quack()

      await waitFor(() => expect(answer(2)).toHaveAccessibleDescription(message))
      expect(answer(2)).toHaveAttribute("aria-invalid", "true")
      expect(answer(1)).toHaveAttribute("aria-invalid", "false")
      expect(addQuack).not.toHaveBeenCalled()
    })

    it("accepts an answer of exactly 80 characters", async () => {
      vi.mocked(addQuack).mockResolvedValue({} as Awaited<ReturnType<typeof addQuack>>)
      renderForm()
      await writePoll("Lunch?", ["Pizza"])
      await userEvent.click(answer(2))
      await userEvent.paste("a".repeat(80))

      await quack()

      await waitFor(() =>
        expect(sent()).toEqual({
          text: "Lunch?",
          mood: undefined,
          poll: { options: ["Pizza", "a".repeat(80)] },
        }),
      )
    })

    it("clears the poll after a successful post", async () => {
      vi.mocked(addQuack).mockResolvedValue({} as Awaited<ReturnType<typeof addQuack>>)
      renderForm()
      await writePoll("Lunch?", ["Pizza", "Thai"])

      await quack()

      await waitFor(() => expect(screen.getByLabelText("New quack")).toHaveValue(""))
      expect(screen.queryByLabelText("Answer 1")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Add poll" })).toBeInTheDocument()
    })

    it("keeps the poll when posting fails", async () => {
      vi.mocked(addQuack).mockRejectedValue(new Error("Server unreachable"))
      renderForm()
      await writePoll("Lunch?", ["Pizza", "Thai"])

      await quack()

      await waitFor(() => expect(screen.getByText("Server unreachable")).toBeInTheDocument())
      expect(answer(1)).toHaveValue("Pizza")
      expect(answer(2)).toHaveValue("Thai")
    })
  })
})
