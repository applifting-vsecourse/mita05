import { expect, test, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

type FeedQuack = {
  id: string
  isDeleted: boolean
  text: string | null
  user: { username: string } | null
  replies: { id: string; text: string }[]
}

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

test("a user replies to a quack and sees the reply under it", async ({ browser }) => {
  const text = `Lunch? ${Date.now()}`
  const replyText = `Pizza ${Date.now()}`
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const quackId = await postQuack(author, text)

  const page = await browser.newPage()
  await signIn(page, "deepduckthoughts@example.com", "password2")
  await page.goto("/quacks")

  const quack = page.getByRole("article").filter({ hasText: text }).first()
  await quack.getByRole("button", { name: "Reply" }).click()
  await quack.getByLabel("Your reply").fill(replyText)
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith(`/quacks/${quackId}/replies`),
    ),
    quack.getByRole("button", { name: "Post reply" }).click(),
  ])
  expect(response.status()).toBe(201)

  const replies = quack.getByRole("list", { name: "Replies" })
  await expect(replies.getByText(replyText)).toBeVisible()
  await expect(replies.getByText("@DeepDuckThoughts")).toBeVisible()
  await expect(quack.getByLabel("Your reply")).toHaveCount(0)
})

test("deleting a quack with replies erases its text everywhere but keeps the replies", async ({
  browser,
}) => {
  const secret = `Secret take ${Date.now()}`
  const replyText = `Reply that stays ${Date.now()}`
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const quackId = await postQuack(author, secret)

  const replier = await browser.newPage()
  await signIn(replier, "deepduckthoughts@example.com", "password2")
  await postReply(replier, quackId, replyText)

  await author.goto("/quacks")
  const quack = author.getByRole("article").filter({ hasText: secret }).first()
  await quack.getByRole("button", { name: "Delete quack" }).click()
  const [response] = await Promise.all([
    author.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().endsWith(`/quacks/${quackId}`),
    ),
    author.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ])
  expect(response.status()).toBe(204)

  // The feed: the reply stays under a placeholder, the text is gone.
  await author.reload()
  const thread = author.getByRole("article").filter({ hasText: replyText }).first()
  await expect(thread.getByText("This quack was deleted")).toBeVisible()
  await expect(thread.getByText(replyText)).toBeVisible()
  await expect(author.getByText(secret)).toHaveCount(0)

  // Search in the UI finds nothing.
  await author.getByLabel("Search quacks").fill(secret)
  await expect(author.getByText(`No quacks match '${secret}'.`)).toBeVisible()

  // And the server sends the text nowhere: not in the feed, its replies, a search or Mine.
  for (const query of ["", `?q=${encodeURIComponent(secret)}`, "?author=me"]) {
    const feedResponse = await author.request.get(`${API}/quacks${query}`)
    expect(feedResponse.status()).toBe(200)
    expect(await feedResponse.text()).not.toContain(secret)
  }
  const feed = (await (await author.request.get(`${API}/quacks`)).json()) as FeedQuack[]
  const placeholder = feed.find((q) => q.id === quackId)!
  expect(placeholder).toMatchObject({ isDeleted: true, text: null, user: null })
  expect(placeholder.replies.map((r) => r.text)).toEqual([replyText])
})

test("the server refuses replies and deletes it shouldn't allow", async ({ browser }) => {
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const quackId = await postQuack(author, `Thread ${Date.now()}`)

  const replier = await browser.newPage()
  await signIn(replier, "deepduckthoughts@example.com", "password2")
  const replyId = await postReply(replier, quackId, "first!")

  // Replies are text only and one level deep.
  const withMood = await replier.request.post(`${API}/quacks/${quackId}/replies`, {
    data: { text: "hi", mood: "happy" },
  })
  expect(withMood.status()).toBe(400)
  const toReply = await replier.request.post(`${API}/quacks/${replyId}/replies`, {
    data: { text: "hi" },
  })
  expect(toReply.status()).toBe(400)

  // Nobody deletes someone else's reply or quack.
  expect((await author.request.delete(`${API}/quacks/${replyId}`)).status()).toBe(403)
  expect((await replier.request.delete(`${API}/quacks/${quackId}`)).status()).toBe(403)

  // Once deleted, the quack can't be replied to or deleted again.
  expect((await author.request.delete(`${API}/quacks/${quackId}`)).status()).toBe(204)
  const toPlaceholder = await replier.request.post(`${API}/quacks/${quackId}/replies`, {
    data: { text: "hi" },
  })
  expect(toPlaceholder.status()).toBe(404)
  expect((await author.request.delete(`${API}/quacks/${quackId}`)).status()).toBe(404)

  // An admin deletes the last reply, and the placeholder goes with it.
  const admin = await browser.newPage()
  await signIn(admin, "admin@example.com", "adminpassword")
  expect((await admin.request.delete(`${API}/quacks/${replyId}`)).status()).toBe(204)
  const feed = (await (await admin.request.get(`${API}/quacks`)).json()) as FeedQuack[]
  expect(feed.find((q) => q.id === quackId)).toBeUndefined()
})
