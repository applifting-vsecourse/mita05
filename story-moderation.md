# Story: Moderator delete

## Why

Someone has started posting nasty quacks. Their author won't delete them, and right now nobody else can. Only an author can delete their own quacks. We need a moderator who can delete any quack. The moderator is the existing admin role (`user.role` is `"admin"`, seeded as admin@example.com). This is the smallest fix that solves the problem, so nothing beyond what's listed here.

## User story

As a moderator (a signed-in admin), I want to delete any quack, so that I can remove nasty quacks when their author won't.

## Acceptance criteria

### Who can delete what

1. An admin can delete any quack, whoever wrote it.
2. Every other user is unchanged: they can delete only their own quacks. Trying to delete someone else's quack is still refused with 403.
3. The server decides who is an admin from the session (`@User()`), never from the request body or URL. Hiding or showing the button in the UI is not the check.
4. A user who isn't signed in still gets 401. A quack that doesn't exist still gets 404, for admins too.

### What deleting does

5. An admin delete works exactly like an owner delete today. The quack, its poll and the poll's votes are permanently removed for everyone.
6. Nothing else is recorded or shown: no placeholder in the feed, no audit log, no message to the author.

### In the feed

7. When an admin is signed in, the existing Delete button shows on every quack in the feed. That includes search results and the Mine filter.
8. For everyone else, the button shows only on their own quacks, as today.
9. The admin sees the same confirm dialog as an owner ("Delete this quack?"), with the same Cancel/Delete actions, loading state and error message on failure.
10. After a successful delete, the quack disappears from the feed, as it does for an owner delete today.

### Unchanged

11. The Mine filter still means "quacks I wrote", for admins too.
12. Posting, voting and search work as they do today.

## Out of scope for this version

- Hiding or soft-deleting quacks, or a "removed by a moderator" placeholder
- An audit log of who deleted what
- Telling the author their quack was removed
- A separate moderation page or queue
- Reporting or flagging quacks
- Banning or suspending users
- Making users admins or removing admin rights from the UI
- Editing other people's quacks
- A different confirm dialog for deleting someone else's quack
