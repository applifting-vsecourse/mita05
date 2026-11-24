# 0002: Likes are rows in a `QuackLike` table, counted on read

## Status

Accepted on 2026-11-24. Implemented in migration `20261124162908_add_quack_likes`. Comes from the likes story ([cases.md](../features/likes/cases.md)).

## Context

People can like a quack (or a reply) to show they like it without replying. The product owner's rules, worked out in `cases.md`:

- Everyone can like a quack only once, and take the like back. Liking twice and unliking when not liked both succeed and change nothing.
- Every quack shows a like count, and each viewer sees whether _they_ have liked it (`likedByMe`).
- Two like requests from the same person at the same moment still count once (A15).
- A tombstone has no likes: they are erased with its content (R13, following ADR 0001). A fully deleted quack takes its likes with it.
- When a user's account is deleted, their likes disappear from every count (A16).
- The like always belongs to the user from the session.

These rules need to know _who_ liked _what_, not just how many. The app is small, and the feed is not paginated, so every read loads every quack.

Poll votes already solve the same problem: one `PollVote` row per person, primary key `(pollId, userId)`, and vote counts are always counted from rows, never stored.

## Decision

Likes are stored one row per person per quack:

```prisma
model QuackLike {
  quack     Quack    @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId   String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime @default(now())

  @@id([quackId, userId])
  @@index([userId])
  @@map("quack_like")
}
```

- **Only once** is enforced by the primary key `(quackId, userId)`, not by application code.
- **Like** inserts the row and treats an existing row as success. **Unlike** deletes by `(quackId, userId)` and treats "no row" as success. Both can be repeated safely.
- **The count is never stored.** `likeCount` is counted from `quack_like` on read, and `likedByMe` checks for a row with the viewer's `userId`, both in the same query that loads the feed (no query per quack).
- **Cascades** remove likes when a quack row is deleted or a user is deleted.
- **Tombstones:** the transaction that turns a quack into a tombstone also deletes its likes, the same way it deletes the poll. Liking or unliking a deleted quack or a tombstone answers 404.
- Likes are the same for a quack in the feed and a reply. There is no separate table for replies.

## Options considered

### A) `QuackLike` table, count worked out on read (chosen)

- **For:**
  - The database guarantees one like per person, including when two requests arrive together.
  - The count can't drift from the likes, because it is counted from them.
  - Cascades handle deleted quacks and deleted accounts with no extra code.
  - It is the same pattern as `PollVote`, so it's one pattern to learn.
  - Moving to C later is one additive migration.
- **Against:**
  - Every feed read counts likes for every quack. That's cheap at this size with the primary key index, but it grows with the number of likes, and the feed isn't paginated.
  - The tombstone transaction gains a step.

### B) A `likeCount` column on `Quack`, and nothing else

- **For:** reading the count is free.
- **Rejected because:**
  - It doesn't record who liked, so it can't enforce "only once", answer `likedByMe`, or remove a deleted user's likes.
  - Two simultaneous likes need careful atomic updates, and any mistake leaves a wrong count for good.
  - The information about who liked is lost and could never be recovered, which would block any later fix or a "who liked this" list.

### C) `QuackLike` table plus a stored `likeCount` on `Quack`

- **For:** the feed reads the count for free, while the table still gives "once", `likedByMe` and the cascades.
- **Rejected for now because:**
  - There are two sources of truth.
  - A cascade (a deleted account, a deleted quack) doesn't update the counter unless a hand-written trigger does it. That is more SQL that Prisma doesn't show, on top of ADR 0001's `CHECK` constraints.
  - Like and unlike would have to know whether they actually changed a row before adjusting the counter, and bugs leave counts that are wrong and stay wrong.
  - It optimises for a load the app doesn't have.

  This stays the planned next step if counting on read becomes too slow (see Consequences).

## Consequences

- **Every query that returns quacks must return `likeCount` and `likedByMe` for the viewer.** That includes the feed, replies, search and "Mine". It must do this in the same query, with no query per quack. A tombstone returns neither field. Each new list of quacks needs a test for this.
- **The tombstone transaction (ADR 0001) also deletes the quack's likes.** A like that arrives while a quack is being deleted must not survive on the tombstone. The like path and the delete path have to agree on this, for example by locking the quack row in both, and this needs its own test.
- **Like and unlike are idempotent at the API.** Clients may retry them freely. Changing this later, for example to return 409 on a second like, would break clients that rely on it.
- **Bulk operations need no special handling for likes.** Deleting a user or hard-deleting a quack cascades. Account deletion is still blocked by ADR 0001's tombstone rule, not by likes.
- **We store who liked what.** The API exposes only counts and the viewer's own `likedByMe`. Showing a list of who liked a quack would be a product decision about privacy, not just a new endpoint.
- **The table is for likes only.** Adding other reactions (emoji, "dislike") would mean adding a `kind` column and changing the primary key while real data exists. That's a new ADR, not an extension of this one.
- **Moving to a stored count stays cheap.** If the feed gets slow, option C needs one migration that adds `likeCount` and fills it from `quack_like`, plus keeping it in sync. Adding pagination to the feed should come first, because that reduces the cost of counting.
