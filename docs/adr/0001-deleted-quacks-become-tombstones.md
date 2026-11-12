# 0001: A deleted quack with replies becomes a content-free tombstone

## Status

Accepted on 2026-11-12. Not implemented yet. Comes from the replies story ([story-replies.md](../../story-replies.md), Decision 2).

## Context

Replies are being added under quacks. A reply is a `Quack` whose `parentId` points at a quack in the feed. The product owner set two requirements that pull in opposite directions:

- Replies belong to the people who wrote them. If an author (or an admin) deletes a quack that already has replies, the replies must not disappear with it.
- When someone deletes a quack, its content must really disappear from the app. Hiding it isn't enough.

Today, deleting a quack removes the row, and its poll, options and votes go with it through `onDelete: Cascade`. Every part of the app assumes that a quack in the database is live and has text and an author. With replies, a plain delete either orphans other people's replies or deletes them along with the parent.

## Decision

Deleting a quack that has replies does not remove the row. In one transaction, it:

- sets `deletedAt`,
- sets `text` and `mood` to `null`,
- deletes the poll (options and votes cascade).

The row stays as a tombstone and keeps its `id`, `createdAt` (its place in the feed) and `userId`. Its replies stay under it.

A quack without replies is still deleted completely, as today. Authors and admins follow the same rule.

The database enforces the tombstone's shape:

- `Quack.text` becomes nullable.
- A hand-written `CHECK` (`quack_deleted_has_no_content`) requires a tombstone to have no text or mood, and a live quack to have text.
- `Quack.parent` uses `onDelete: Restrict`, so the database refuses to hard-delete a quack that still has replies, even when a reply arrives in the middle of a delete.

The API never returns a tombstone's text, mood, poll or author. Tombstones are never matched by search and never listed in "Mine". When the last reply under a tombstone is deleted, the tombstone is deleted too.

## Options considered

### A) Tombstone with content erased, only when there are replies (chosen)

- **For:** the thread stays together and the replies stay readable in context. The content is really gone from the database, not hidden. Quacks without replies keep the simple hard delete.
- **Against:** a quack row can now exist without content, so every reader has to handle that. Erased content can never be restored, which is what the product owner asked for.

### B) Hard delete, replies get `parentId = NULL` (`onDelete: SetNull`)

- **For:** the simplest option. No new state, `text` stays required and delete works as it does today.
- **Rejected because:** replies would suddenly appear in the feed as standalone quacks with no context. The fact that they were replies would be lost for good, so we could never later show "reply to a deleted quack" for existing data.

### C) Hard delete, replies kept but hidden

- **For:** no tombstone shows in the UI.
- **Rejected because:** it breaks the requirement that replies must not disappear. The parent's author would in effect delete other people's content, and the database would keep orphaned rows nobody can see or clean up.

### D) Soft delete that keeps the content in the row (only `deletedAt`, text left in place)

- **For:** reversible, and a common pattern.
- **Rejected because:** it breaks "the content has to really disappear". The text would still be in the database, backups and any query that forgets the filter.

### Rejected detail: also erase `userId` on the tombstone

Making `userId` nullable would also remove the trace of who wrote the deleted quack. We rejected it for now:

- `userId` would become nullable for every quack.
- Only another hand-written `CHECK` could ensure a live quack has an author.
- Every reader of the author would have to handle `null`.

The product owner's requirement is about content, and that is erased in full. A later migration can still null `userId` on existing tombstones.

## Consequences

These apply to the whole app, not only replies.

- **Every read of `Quack` must handle tombstones.** `text` is `string | null` in Prisma types, domain types, DTOs and zod schemas. Any new list of quacks (a profile page, statistics, an export, moderation tools) must filter on `deletedAt: null` unless it deliberately shows tombstones as placeholders for replies. Each new query needs a test for this.
- **Erasure is permanent.** No feature can "undo" a delete of a quack with replies. Any future audit log, moderation history or "restore" feature must not keep a copy of the erased content, or it reintroduces what this decision removes.
- **Delete is no longer a single `DELETE`.** Deleting a quack means checking for replies and running a transaction. Code that deletes quacks in bulk must use the same path:
  - moderation tools
  - scripts
  - a future account deletion
  - anything else

  A raw `DELETE` on a quack with replies fails with a foreign-key error (`Restrict`).

- **Deleting a user account is blocked if they have quacks with replies.** `Quack.user` still cascades, but `Restrict` on `Quack.parent` refuses to hard-delete a quack with other people's replies. Account deletion isn't enabled today. When it is added, it must first turn the user's quacks with replies into tombstones.
- **Features attached to a quack must decide what happens on erasure.** A poll is deleted with the content. Any future attachment (images, links, reactions, edit history) must be erased when the quack becomes a tombstone, or explicitly kept, with a reason in a new ADR.
- **Some invariants are in hand-written SQL.** The `CHECK` constraints are in the migration, not in `schema.prisma`, and Prisma doesn't show them. Anyone changing `Quack`'s columns has to read the migration too.
- **Rolling back to a hard delete stays possible, but not cleanly.** Existing tombstones and their replies would need a decision (delete them, or turn the replies into standalone quacks). The erased content can't come back either way.
