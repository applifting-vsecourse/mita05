# Search the quack feed

**As a** signed-in Quacker user
**I want to** type a word I remember, or who wrote the post, and see only the matching posts
**So that** I can find a post I saw earlier without scrolling through the whole feed

**Why now:** users report they can't find posts they saw last week. This is a minimal version to find out whether people use search.

## Acceptance criteria

### Search field

1. On `/quacks`, there is a search field above the feed, and the "post a quack" form is still visible.
2. When I type in the field, the list updates without me pressing Enter or a button.
3. After I search for `lunch`, the address bar shows `?q=lunch`. When I refresh the page, the same filtered list shows.
4. When I clear the field, or type only spaces, the full feed shows.
5. When I'm signed out and open `/quacks?q=lunch`, I'm redirected to login.

### What matches

6. Searching `DUCK` finds a post containing "duck", so case doesn't matter.
7. Searching `duck` finds posts containing "ducks" and "rubberduck", so part of a word is enough.
8. Searching part of an author's display name, like `adel` for "Adela Mitrova", shows that author's posts.
9. Searching part of an author's @username shows that author's posts.
10. Searching `@ada` shows the same posts as `ada`.
11. Searching `lunch adela` shows Adela's posts that mention lunch. It does not show other people's lunch posts, or Adela's posts without "lunch".
12. Matching results show newest first, and they look the same as normal feed items.

### Empty state

13. Searching for something that matches nothing shows "No quacks match '‹term›'." and a button.
14. When I click that button, the field clears and the full feed shows.
15. With a search active, when I post a quack that doesn't match it, the new quack doesn't appear in the list. When I clear the search, it does appear.

## Out of scope

- Accent-insensitive matching (`kacka` will **not** find "Kačka")
- Filtering by mood or date, highlighting matches, relevance ranking, typo tolerance
- Measuring how often search is used (server logging or analytics), to be added once the first version proves useful
- Pagination

## Technical notes

- Filtering happens on the server: `GET /api/quacks?q=…`.
- The frontend waits about 300 ms after the last keystroke before searching, so typing a word quickly sends one request, not one per letter.
