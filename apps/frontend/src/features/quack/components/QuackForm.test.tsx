import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm />
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
})
