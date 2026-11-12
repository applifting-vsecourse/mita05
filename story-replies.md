# Story: Replies under quacks

## Why

People discuss under quacks by posting a new quack that starts with "@name …". Nobody can tell what anyone is replying to, and the conversation is scattered across the feed. Replies let someone answer a quack directly and show the answers under it.

Replies belong to the people who wrote them. If an author deletes a quack that already has replies, the replies must not disappear with it. When someone deletes their quack, its content must really disappear from the app, not just be hidden. This is a first version, so nothing beyond what's listed here.

## User story

As a signed-in Quacker user, I want to reply to a quack and see the replies under it, so that everyone can tell what each reply answers.

## Acceptance criteria

### Writing a reply

1. Every quack in the feed has a "Reply" button. It opens a small form under the quack with a text field and a submit button. The form has no mood picker and no "Add poll".
2. A reply's text is required, 1–280 characters, the same as a quack. The form and the API both reject anything else.
3. A reply has no mood and no poll. The API refuses a reply that sends `mood` or `poll` with 400.
4. You can reply to any quack in the feed, your own included.
5. Replies are one level deep: you can't reply to a reply. The API answers a reply to a reply with 400. To react to a reply, you write another reply under the same quack.
6. Replying to a quack that doesn't exist or has been deleted gets 404 ("Quack not found").
7. The author comes from the session, never from the request body or URL. A user who isn't signed in gets 401.
8. A reply appears under the quack once the server confirms it. Replies aren't optimistic. On success, the form clears and closes. On failure, the text stays in the form and a short error message appears.

### Seeing replies

9. All replies are shown under their quack, oldest first, so the conversation reads top to bottom. They load together with the feed, with no separate "show replies" step.
10. A reply shows its author's name, username, time and text, like a quack, only nested under its parent.
11. Replies never appear in the feed as standalone quacks.

### Deleting

12. Who can delete what is unchanged and also applies to replies: the author can delete their own quack or reply, and an admin can delete any. Anyone else gets 403. The check is on the server, using the session user. Hiding the button is not the check.
13. Replies have the same Delete button and the same confirm dialog as quacks.
14. Deleting a quack without replies removes it completely, as today. Its poll and votes go with it.
15. Deleting a quack that has replies keeps the replies. The quack becomes a placeholder: its text, mood and poll (with votes) are permanently erased from the database. In the feed it shows only "This quack was deleted", with no author, no mood and no time of its own, and its replies stay under it. Author and admin deletes work the same way.
16. A deleted quack (placeholder) can't be found by search and doesn't appear in "Mine". Its only purpose is to hold its replies in the feed. The API never returns its text, mood, poll or author.
17. Deleting a reply removes it completely. If it was the last reply under a placeholder, the placeholder is removed in the same transaction.
18. Nobody can reply to a placeholder (see AC 6), so once its last reply is deleted it is gone for good.
19. If someone replies while the author is deleting the quack, the reply is never lost. Either the quack becomes a placeholder with the reply under it, or the reply is refused with 404. The database enforces this, not only the code.

### Search and "Mine"

20. Search matches only quacks in the feed: their text, author name and username, as today. Reply text is not searched. A matching quack is shown with all its replies.
21. "Mine" lists the quacks in the feed that I wrote, with all their replies. My replies under other people's quacks are not in "Mine".
22. These rules apply to every list of quacks, including any per-user list added later.

## Out of scope for this version

- Replying to a reply, or showing which reply a reply answers
- Searching reply text, or listing my replies in "Mine"
- Collapsing replies, reply counts, or loading replies separately
- Editing replies
- Live updates of new replies
- Notifications for replies

## Known limitation: deleting a user account

Deleting a user still cascades to their quacks (`onDelete: Cascade` on `Quack.user`). A quack that has other people's replies can't be hard-deleted (`onDelete: Restrict` on `Quack.parent`), so deleting the account of a user whose quack has someone else's replies fails. This can't happen today because account deletion is not enabled in BetterAuth. Any future account-deletion feature must first turn that user's quacks with replies into placeholders (AC 15), then delete the rest.

## Decisions

### 1. A reply is a `Quack` with a nullable `parentId`

- **Chosen:** a reply is a row in `quack` that points at its parent. It reuses the author, text, time, delete permissions (author or admin), validation and the place where the "content really disappears" rule lives.
- **Rejected: a separate `Reply` table.** It would duplicate the author, delete, permission and endpoint logic. The "content really disappears" rule would then have to be kept in two places. Moving to nested replies or promoting a reply to the feed later would mean moving rows between tables and changing ids.
- **Rejected: a link table `QuackReply(parentId, replyId)`.** It handles a many-to-many relationship we don't need. "At most one parent" would rely on a unique index instead of a plain column, and every query would need an extra join.

### 2. Deleting a quack with replies leaves a placeholder (tombstone) with its content erased

- **Chosen:** if the quack has replies, the same transaction sets `deletedAt`, sets `text` and `mood` to null and deletes the poll. Otherwise the quack is fully deleted, as today. The same rule applies to authors and admins. The thread stays together and the content is really gone from the database.
- **Rejected: a hard delete with `onDelete: SetNull` on replies.** The replies would suddenly show up in the feed as standalone quacks with no context, and the fact that they were replies would be lost and couldn't be restored.
- **Rejected: a hard delete that hides the replies.** The parent's author would in effect delete other people's content, which the product owner ruled out, and the database would keep orphaned rows nobody knows about.

### 3. The placeholder stays in the feed only to hold its replies

- **Chosen:** it keeps its place in the feed and shows "This quack was deleted" with its replies under it. It has no content or author, isn't found by search and isn't in "Mine".
- **Rejected: a separate thread page (`/quacks/:id`) with the placeholder left out of the feed.** Nothing in the feed would link to it, so in practice the replies would disappear. It would also add a URL we'd have to support forever.
- **Rejected: showing the placeholder's replies as standalone feed items marked "Reply to a deleted quack".** The conversation would fall apart into fragments and the feed query would get more complex.

### 4. Replies are one level deep

- **Chosen:** a reply's parent must be a quack in the feed (`parentId` null). The feed loads with one `include` and no recursion. Only quacks in the feed can become placeholders. The schema could already hold deeper threads, so allowing them later would be a rule change, not a schema change.
- **Rejected: an arbitrarily deep tree.** Prisma can't load it with one query, placeholders could end up in the middle of a tree, and "delete the placeholder after its last reply" would have to cascade upward. Once deep trees exist in the data, going back to one level would mean rewriting data.
- **Rejected: one level plus a `replyToId` that names the reply being answered.** It adds a second reference that would need its own rules when the referenced reply is deleted. That's more than a first version needs.

### 5. A reply is text only

- **Chosen:** 1–280 characters of text. Replies have no mood and no poll, and the API rejects both with 400.
- **Rejected: replies with an optional mood.** The product owner wants the reply form to be just a text field and a button.
- **Rejected: polls in replies.** Two levels of voting under one quack would be hard to read.

### 6. Replies load with the feed and are all shown

- **Chosen:** `GET /api/quacks` includes each quack's replies, oldest first. This adds no new read endpoint and works the same way polls already do.
- **Rejected: a "3 replies" toggle that loads replies with `GET /api/quacks/:id/replies`.** It would add another endpoint, another query and another loading state, plus a reply count per quack. This would only pay off with a much bigger feed. Switching later changes the API and UI, not the data.
- **Rejected: showing the last two replies with "Show all (N)".** It combines the complexity of both options above.

### 7. Search and "Mine" work only on quacks in the feed

- **Chosen:** this keeps the existing query, plus `parentId: null` and `deletedAt: null`. The rule "a placeholder is never found or listed in Mine" holds exactly.
- **Rejected: matching anywhere in the thread.** A thread whose quack is a placeholder would appear in results because of a matching reply, which breaks the placeholder rule. It also needs nested `some` filters, with wildcard escaping in each one. This could be added later by extending the `OR`.
- **Rejected: replies as standalone search results.** It needs a new way to display items in the feed, which is the most work of the three.

### 8. Replies are created with `POST /api/quacks/:quackId/replies`

- **Chosen:** the body is `{ text }`, validated by a small `CreateReplyDto`. `forbidNonWhitelisted` rejects `mood` and `poll` with 400 without conditional validation. Deleting uses the existing `DELETE /api/quacks/:quackId`.
- **Rejected: an optional `parentId` on `POST /api/quacks`.** `CreateQuackDto` would need conditional rules ("no mood or poll when there's a parent") that are easy to forget, and Swagger would become harder to read.

### 9. A placeholder keeps its `userId` in the database but never exposes it

- **Chosen:** `Quack.userId` stays required and the user relation is unchanged. The content (text, mood, poll) is erased, and the API never returns the author of a placeholder, which a test enforces.
- **Rejected: setting `userId` to null on placeholders.** That would make `userId` nullable for every quack. Only a hand-written `CHECK` could then ensure a live quack has an author, and every place that reads the author would have to handle null. Once erased, the author can't be restored. We can still switch to this later with a migration that nulls `userId` on placeholders.

## Where it lands in the code

ESLint import boundaries keep features apart. Replies are rendered by `QuackItem`, so all frontend work stays in `features/quack`.

- **Backend `modules/quack`:**
  - `QuackRepository`: feed with `parentId: null` and replies included; search and "Mine" with `deletedAt: null`; create a reply; delete or turn into a placeholder in a transaction.
  - `QuacksService`: the 400/403/404 rules.
  - `QuacksController`: new route and `CreateReplyDto`.
  - `QuackResponseDto`: `replies`, `isDeleted`, nullable `text` and `user`.
  - Seed: a few replies.
- **`modules/poll`:** no code changes. A placeholder's poll is deleted through the existing cascade.
- **Frontend `features/quack`:**
  - `quackSchemas` (zod)
  - `addReply` + `useAddReply`
  - `QuackItem`: replies, the Reply button and the placeholder
  - new `ReplyForm`
  - `DeleteQuackButton` reused for replies

## Proposed schema

Only `Quack` changes:

```prisma
model Quack {
  id        String     @id @default(cuid())
  // null only for a deleted quack kept as a placeholder for its replies
  text      String?    @db.Text
  // always null on replies and on deleted quacks
  mood      QuackMood?
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  poll      Poll?
  // Set on a reply: the quack in the feed it answers. One level only — a
  // parent always has parentId null (checked by the service). Restrict: a quack
  // that still has replies can't be hard-deleted, only turned into a placeholder.
  parent    Quack?     @relation("QuackReplies", fields: [parentId], references: [id], onDelete: Restrict)
  parentId  String?
  replies   Quack[]    @relation("QuackReplies")
  // Set when a quack with replies is deleted: text, mood and poll are wiped in
  // the same transaction. Only quacks in the feed (parentId null) get one.
  deletedAt DateTime?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt

  @@index([userId])
  @@index([parentId, createdAt])
  @@map("quack")
}
```

The generated migration gets two hand-written constraints that Prisma can't express:

```sql
-- a placeholder has no text or mood; a live quack always has text
ALTER TABLE "quack" ADD CONSTRAINT "quack_deleted_has_no_content"
  CHECK (("deletedAt" IS NULL) = ("text" IS NOT NULL) AND ("deletedAt" IS NULL OR "mood" IS NULL));
-- a reply has no mood, is never a placeholder, and doesn't answer itself
ALTER TABLE "quack" ADD CONSTRAINT "quack_reply_shape"
  CHECK ("parentId" IS NULL OR ("mood" IS NULL AND "deletedAt" IS NULL AND "parentId" <> "id"));
```

Two rules span rows, so the service enforces them and tests cover them: a reply's parent must be a quack in the feed, and a reply has no poll.

### Migration on existing data

The migration adds two nullable columns without defaults (no table rewrite), drops `NOT NULL` from `text`, and adds one index and a self-referencing foreign key. All existing rows satisfy both `CHECK` constraints: every quack has text, and none has a `parentId` or `deletedAt`. Old code still works against the new schema.

We checked this on a copy of the seeded database (13 quacks):

- The migration applied cleanly and all 13 quacks stayed live in the feed.
- Hard-deleting a quack with a reply was refused by `Restrict`.
- Setting `deletedAt` without clearing the text was refused by `quack_deleted_has_no_content`.
- Giving a reply a mood was refused by `quack_reply_shape`.
- A correct placeholder update went through.
