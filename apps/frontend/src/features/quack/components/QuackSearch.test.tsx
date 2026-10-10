import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { QuackSearch, SEARCH_DELAY_MS } from "@/features/quack/components/QuackSearch"

const setup = (search = "") => {
  const onSearchChange = vi.fn()
  const view = render(
    <QuackSearch
      search={search}
      onSearchChange={onSearchChange}
    />,
  )
  const input = screen.getByLabelText("Search quacks")
  // Fake timers and user-event don't mix in Vitest, so type one change per keystroke.
  const type = (text: string) => {
    for (let i = 1; i <= text.length; i++) {
      fireEvent.change(input, { target: { value: text.slice(0, i) } })
    }
  }
  const rerender = (next: string) =>
    view.rerender(
      <QuackSearch
        search={next}
        onSearchChange={onSearchChange}
      />,
    )
  return { onSearchChange, input, type, rerender }
}

const waitForPause = (): void => {
  act(() => {
    vi.advanceTimersByTime(SEARCH_DELAY_MS)
  })
}

describe("QuackSearch", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("searches once typing pauses, not per letter", () => {
    const { onSearchChange, type } = setup()

    type("lunch")
    expect(onSearchChange).not.toHaveBeenCalled()

    waitForPause()
    expect(onSearchChange).toHaveBeenCalledExactlyOnceWith("lunch")
  })

  it("trims the search and treats spaces only as no search", () => {
    const { onSearchChange, type } = setup("lunch")

    type("   ")
    waitForPause()

    expect(onSearchChange).toHaveBeenCalledExactlyOnceWith("")
  })

  it("starts with the search from the URL", () => {
    const { input } = setup("lunch")

    expect(input).toHaveValue("lunch")
  })

  it("shows a search changed from outside, e.g. by Clear search", () => {
    const { input, rerender } = setup("xyz")

    rerender("")

    expect(input).toHaveValue("")
  })

  it("keeps what the user is typing when its own search lands in the URL", () => {
    const { onSearchChange, input, type, rerender } = setup()

    type("lunch ")
    waitForPause()
    expect(onSearchChange).toHaveBeenCalledWith("lunch")

    rerender("lunch")

    expect(input).toHaveValue("lunch ")
  })
})
