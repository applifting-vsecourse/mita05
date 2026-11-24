// Likes, end to end: the flows E1–E4 in docs/features/likes/cases.md.
// Every step that changes a like asserts the server's status, not only the screen.
import { expect, test, type Locator, type Page, type Response } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

const ALICE = { email: "caffeinatedduck@example.com", password: "password1" }
const BOB = { email: "deepduckthoughts@example.com", password: "password2" }

async function postQuack(page: Page, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function postReply(page: Page, quackId: string, text: string): Promise<string> {
  const response = await page.request.post(`${API}/quacks/${quackId}/replies`, { data: { text } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function likeByApi(page: Page, quackId: string): Promise<void> {
  const response = await page.request.put(`${API}/quacks/${quackId}/like`)
  expect(response.status()).toBe(200)
}

async function unlikeByApi(page: Page, quackId: string): Promise<void> {
  const response = await page.request.delete(`${API}/quacks/${quackId}/like`)
  expect(response.status()).toBe(200)
}

/** The quack's own Like button, not one of its replies'. */
function likeButtonOf(page: Page, text: string): Locator {
  return page
    .getByRole("article")
    .filter({ hasText: text })
    .getByRole("button", { name: "Like" })
    .first()
}

/** Clicks Like and returns the like request's response. */
async function clickLike(page: Page, button: Locator, quackId: string): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/quacks/${quackId}/like`)),
    button.click(),
  ])
  return response
}

test("E1: a user likes a quack and takes the like back", async ({ page }) => {
  const text = `Like me ${Date.now()}`
  await signIn(page, ALICE.email, ALICE.password)
  const quackId = await postQuack(page, text)
  await page.goto("/quacks")

  const like = likeButtonOf(page, text)
  await expect(like).toHaveText("0")
  await expect(like).toHaveAttribute("aria-pressed", "false")

  const liked = await clickLike(page, like, quackId)
  expect(liked.request().method()).toBe("PUT")
  expect(liked.status()).toBe(200)
  await expect(like).toHaveText("1")
  await expect(like).toHaveAttribute("aria-pressed", "true")

  await page.reload()
  await expect(like).toHaveText("1")
  await expect(like).toHaveAttribute("aria-pressed", "true")

  const unliked = await clickLike(page, like, quackId)
  expect(unliked.request().method()).toBe("DELETE")
  expect(unliked.status()).toBe(200)
  await expect(like).toHaveText("0")
  await expect(like).toHaveAttribute("aria-pressed", "false")

  await page.reload()
  await expect(like).toHaveText("0")
})

test("E2: two people like the same quack", async ({ browser }) => {
  const text = `Like us ${Date.now()}`
  const alice = await browser.newPage()
  await signIn(alice, ALICE.email, ALICE.password)
  const quackId = await postQuack(alice, text)
  await likeByApi(alice, quackId)

  const bob = await browser.newPage()
  await signIn(bob, BOB.email, BOB.password)
  await bob.goto("/quacks")
  const like = likeButtonOf(bob, text)
  await expect(like).toHaveText("1")
  await expect(like).toHaveAttribute("aria-pressed", "false")

  const liked = await clickLike(bob, like, quackId)
  expect(liked.status()).toBe(200)
  await expect(like).toHaveText("2")
  await expect(like).toHaveAttribute("aria-pressed", "true")

  await unlikeByApi(alice, quackId)
  await bob.reload()
  await expect(like).toHaveText("1")
  await expect(like).toHaveAttribute("aria-pressed", "true")
})

test("E3: a signed-out client can't like or unlike", async ({ page, playwright }) => {
  const text = `Signed-out ${Date.now()}`
  await signIn(page, ALICE.email, ALICE.password)
  const quackId = await postQuack(page, text)
  await likeByApi(page, quackId)

  // No cookies: a visitor who isn't signed in.
  const visitor = await playwright.request.newContext()
  expect((await visitor.put(`${API}/quacks/${quackId}/like`)).status()).toBe(401)
  expect((await visitor.delete(`${API}/quacks/${quackId}/like`)).status()).toBe(401)
  await visitor.dispose()

  await page.goto("/quacks")
  const like = likeButtonOf(page, text)
  await expect(like).toHaveText("1")
  await expect(like).toHaveAttribute("aria-pressed", "true")
})

test("E4: a deleted quack's placeholder has no like button, its reply keeps one", async ({
  browser,
}) => {
  const text = `Doomed ${Date.now()}`
  const replyText = `Survivor ${Date.now()}`
  const alice = await browser.newPage()
  await signIn(alice, ALICE.email, ALICE.password)
  const quackId = await postQuack(alice, text)

  const bob = await browser.newPage()
  await signIn(bob, BOB.email, BOB.password)
  await postReply(bob, quackId, replyText)
  await likeByApi(bob, quackId)

  const deleted = await alice.request.delete(`${API}/quacks/${quackId}`)
  expect(deleted.status()).toBe(204)

  await bob.goto("/quacks")
  const article = bob.getByRole("article").filter({ hasText: replyText })
  await expect(article.getByText("This quack was deleted")).toBeVisible()
  const replies = article.getByRole("list", { name: "Replies" })
  await expect(replies.getByRole("button", { name: "Like" })).toHaveCount(1)
  // the only Like button left is the reply's
  await expect(article.getByRole("button", { name: "Like" })).toHaveCount(1)
})
