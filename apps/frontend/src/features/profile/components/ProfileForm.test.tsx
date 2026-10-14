import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import type { Profile } from "@/features/profile/api/profileSchemas"
import { updateProfile } from "@/features/profile/api/updateProfile"
import { ProfileForm } from "@/features/profile/components/ProfileForm"

vi.mock("@/features/profile/api/updateProfile", () => ({ updateProfile: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const profile: Profile = {
  id: "u1",
  name: "Caffeinated Duck",
  username: "caffeinatedduck",
  bio: null,
  defaultMood: null,
}

const conflict = () =>
  new HTTPError(
    new Response(null, { status: 409 }),
    new Request("http://localhost/api/profile", { method: "PUT" }),
    {} as ConstructorParameters<typeof HTTPError>[2],
  )

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileForm profile={profile} />
    </QueryClientProvider>,
  )

const usernameInput = () => screen.getByLabelText("Username")
const save = () => userEvent.click(screen.getByRole("button", { name: "Save changes" }))

const retype = async (element: HTMLElement, text: string) => {
  await userEvent.clear(element)
  if (text) await userEvent.type(element, text)
}

describe("ProfileForm", () => {
  beforeEach(() => {
    vi.mocked(updateProfile).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("starts with the saved profile", () => {
    renderForm()

    expect(usernameInput()).toHaveValue("caffeinatedduck")
    expect(screen.getByLabelText("Display name")).toHaveValue("Caffeinated Duck")
    expect(screen.getByLabelText("Bio")).toHaveValue("")
    expect(screen.getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "true")
  })

  it("saves every field, sending an empty bio and no mood as null", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ...profile, username: "duck.lover" })
    renderForm()

    await retype(usernameInput(), "duck.lover")
    await save()

    await waitFor(() =>
      expect(vi.mocked(updateProfile).mock.calls[0]?.[0]).toEqual({
        username: "duck.lover",
        name: "Caffeinated Duck",
        bio: null,
        defaultMood: null,
      }),
    )
  })

  it("saves the picked default mood and bio", async () => {
    vi.mocked(updateProfile).mockResolvedValue(profile)
    renderForm()

    await userEvent.type(screen.getByLabelText("Bio"), "Mostly bread.")
    await userEvent.click(screen.getByRole("radio", { name: "Silly" }))
    await save()

    await waitFor(() =>
      expect(vi.mocked(updateProfile).mock.calls[0]?.[0]).toMatchObject({
        bio: "Mostly bread.",
        defaultMood: "silly",
      }),
    )
  })

  it("confirms the save and shows the username as stored", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ...profile, username: "duck.lover" })
    renderForm()

    await retype(usernameInput(), "Duck.Lover")
    await save()

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"))
    expect(usernameInput()).toHaveValue("duck.lover")
  })

  it.each([
    ["ab", "Use at least 3 characters"],
    ["a".repeat(31), "Use at most 30 characters"],
    ["duck lover", "Use only letters, numbers, dots and underscores"],
    ["duck-lover", "Use only letters, numbers, dots and underscores"],
  ])("rejects the username %p before asking the server", async (username, message) => {
    renderForm()

    await retype(usernameInput(), username)
    await save()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("requires a display name", async () => {
    renderForm()

    await retype(screen.getByLabelText("Display name"), "")
    await save()

    expect(await screen.findByText("Display name is required")).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("limits the bio to 160 characters", async () => {
    renderForm()

    // paste rather than type: 161 keystrokes are slow and prove nothing more
    await userEvent.click(screen.getByLabelText("Bio"))
    await userEvent.paste("a".repeat(161))
    await save()

    expect(await screen.findByText("Keep it under 160 characters")).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("says a taken username is taken, next to the field, and keeps what was typed", async () => {
    vi.mocked(updateProfile).mockRejectedValue(conflict())
    renderForm()

    await retype(usernameInput(), "taken.name")
    await save()

    const message = await screen.findByText("That username is already taken")
    expect(usernameInput()).toHaveAttribute("aria-invalid", "true")
    expect(usernameInput().getAttribute("aria-describedby")).toContain(message.id)
    expect(usernameInput()).toHaveValue("taken.name")
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("discards changes back to the saved profile", async () => {
    renderForm()

    await retype(usernameInput(), "something.else")
    await retype(screen.getByLabelText("Display name"), "Someone Else")
    await userEvent.click(screen.getByRole("radio", { name: "Angry" }))
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }))

    expect(usernameInput()).toHaveValue("caffeinatedduck")
    expect(screen.getByLabelText("Display name")).toHaveValue("Caffeinated Duck")
    expect(screen.getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "true")
  })

  it("discards back to what was last saved, not what the page loaded with", async () => {
    vi.mocked(updateProfile).mockResolvedValue({ ...profile, username: "duck.lover" })
    renderForm()

    await retype(usernameInput(), "duck.lover")
    await save()
    await waitFor(() => expect(toast.success).toHaveBeenCalled())

    await retype(usernameInput(), "another.one")
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }))

    expect(usernameInput()).toHaveValue("duck.lover")
  })
})
