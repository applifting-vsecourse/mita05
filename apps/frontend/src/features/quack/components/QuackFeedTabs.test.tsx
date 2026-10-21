import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { QuackFeedTabs } from "@/features/quack/components/QuackFeedTabs"

describe("QuackFeedTabs", () => {
  it("shows All and Mine, with the active one selected", () => {
    render(
      <QuackFeedTabs
        filter="mine"
        onFilterChange={vi.fn()}
      >
        feed
      </QuackFeedTabs>,
    )

    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "false")
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("feed")
  })

  it("asks for the other filter when its tab is picked", async () => {
    const onFilterChange = vi.fn()
    render(
      <QuackFeedTabs
        filter="all"
        onFilterChange={onFilterChange}
      >
        feed
      </QuackFeedTabs>,
    )

    await userEvent.click(screen.getByRole("tab", { name: "Mine" }))

    expect(onFilterChange).toHaveBeenCalledWith("mine")
  })
})
