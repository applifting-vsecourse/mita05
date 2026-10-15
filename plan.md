# Plan: Polls

Implements [story.md](story.md). The numbers in brackets (AC 7) point to its acceptance criteria. Everything follows the quack pattern: schema → seed → repository → service → DTO/controller → zod schema → TanStack Query → components.

## Data model

Three new tables. A quack has zero or one poll.

```prisma
model Poll {
  id        String       @id @default(cuid())
  quack     Quack        @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId   String       @unique
  options   PollOption[]
  votes     PollVote[]
  createdAt DateTime     @default(now())

  @@map("poll")
}

model PollOption {
  id       String     @id @default(cuid())
  poll     Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId   String
  text     String     @db.VarChar(80)
  position Int        // 0–3, the order the author typed them in
  votes    PollVote[]

  @@unique([pollId, position])
  @@unique([id, pollId])   // target for PollVote's composite foreign key
  @@map("poll_option")
}

model PollVote {
  poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId    String
  option    PollOption @relation(fields: [optionId, pollId], references: [id, pollId], onDelete: Cascade)
  optionId  String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @default(now()) @updatedAt

  @@id([pollId, userId])   // one person, one vote — enforced by the database
  @@index([optionId])
  @@map("poll_vote")
}
```

Plus back-relations: `Quack.poll Poll?` and `User.pollVotes PollVote[]`.

Why it's shaped like this:

- **One vote per person is a primary key, not a check in code** (AC 7). `@@id([pollId, userId])` makes a second vote impossible even when two tabs vote at the same moment. Changing your vote updates that row.
- **A vote can only point at an answer of the same poll.** The composite foreign key `(optionId, pollId) → PollOption(id, pollId)` makes the database reject a vote for poll A that names an answer from poll B.
- **Counts are never stored; they're counted.** Each answer's count is `COUNT(poll_vote)` for that option, and the total is the sum. A stored counter can drift, but a count is always right (AC 15). With 2–4 answers per poll and a feed-sized page, the extra counting is cheap.
- **A separate `Poll` table instead of putting options directly on `Quack`** gives the vote endpoint a stable id, and leaves room for things like closing a poll later without touching `quack`.
- **Duplicate answers** are checked by the API after trimming and ignoring case (`"Pizza"` and `" pizza "` count as the same). The database doesn't enforce this. It's an input rule, not an integrity rule.

Migration: one migration, `add_polls`, created with `pnpm backend prisma:migrations:run`. Seed: add one poll quack ("Where do we go for lunch?", 3 answers) with a few votes from existing seed users, so the feed shows a poll right away.

## Endpoints

### `POST /api/quacks` — extended

Body gains an optional `poll`:

```json
{
  "text": "Where do we go for lunch?",
  "mood": "happy",
  "poll": { "options": ["Pizza", "Thai", "Salad bar"] }
}
```

- `poll.options`: array of 2–4 strings. Each is trimmed, 1–80 characters, and unique after trimming and ignoring case (AC 3). It uses class-validator (`ArrayMinSize`, `ArrayMaxSize`, `MaxLength`, `ArrayUnique` with a normalising mapper, plus `Transform` to trim). A body without `poll` behaves exactly as today.
- The quack, poll and options are created in one nested Prisma `create`, so they succeed or fail together.
- Returns the quack in the list shape below, with an empty poll.

### `GET /api/quacks` — extended

Each quack gains `poll`, which is `null` when there is no poll:

```json
"poll": {
  "id": "…",
  "options": [
    { "id": "…", "text": "Pizza", "voteCount": 3 },
    { "id": "…", "text": "Thai", "voteCount": 1 }
  ],
  "totalVotes": 4,
  "myVoteOptionId": "…"
}
```

- `options` are in `position` order.
- `myVoteOptionId` is the current user's answer, or `null`. It's the only per-viewer field, and it never reveals anyone else's vote (AC 14). To compute it, the controller now passes the session user into `list` (it already requires sign-in).
- It's fetched in the same `findMany`, using `include: { poll: { include: { options: { include: { _count: { select: { votes: true } } } }, votes: { where: { userId } } } } }`. That gives one query and no N+1.
- **Search doesn't change** (AC 18): the repository's `where` stays exactly as it is, and a test pins that.

### `PUT /api/polls/:pollId/vote` — new

Body: `{ "optionId": "…" }`. The voter is taken from the session, never from the body.

- `PUT` because it sets "my vote in this poll" to a value. Repeating it is harmless, so voting for your current answer is a no-op on the server too (AC 9).
- Implemented as a Prisma `upsert` on `(pollId, userId)`: it creates the first vote, or moves an existing vote to another answer (AC 8). If two first votes race, one hits the primary key; on `P2002`, retry once as an update.
- Returns `200` with the updated poll in the same shape as in `GET`, so the client can replace its optimistic guess with the server's numbers.
- `404` if the poll doesn't exist. `400` if `optionId` isn't one of this poll's answers. The service checks this first for a clear message, and the composite FK backs it up. `401` if not signed in.
- There is no `DELETE`, because removing a vote is out of scope (AC 9).

Lives in a new `apps/backend/src/modules/poll/` module (controller, service, repository, DTOs), the same layout as `quack/`. Creating and reading polls stays in the quack repository because polls are created and listed with their quack. Only voting is its own module.

## Frontend

- **Schemas** (`features/quack/api/quackSchemas.ts`): `pollSchema`, and `quackSchema.poll` becomes `pollSchema.nullable()`.
- **Showing a poll** (`features/poll/components/QuackPoll.tsx`, rendered inside `QuackItem` under the text):
  - Each answer is a full-width `Button` (`variant="outline"`, `aria-pressed` on your pick) showing the text, the count, and a percentage bar behind it.
  - The bar uses `bg-secondary`, not `primary` (DESIGN.md: primary is for actions). Your pick gets a check icon and `font-medium`.
  - Under the answers, `text-muted-foreground` shows "4 votes", or "No votes yet" with 0% bars.
  - Percentages are rounded, so they may add up to 99 or 101. That's acceptable.
  - No card inside the quack. Spacing and the existing hairline only.
- **Voting** (`features/poll/hooks/useVote.ts`):
  - **Clicking your current answer** sends nothing (AC 9).
  - **Optimistic update** (AC 16): `onMutate` cancels in-flight quack queries, snapshots them, and moves the vote in _every_ cached quack list (`setQueriesData` on `quackKeys.lists()`, because search results are cached separately).
  - **Last click wins** (AC 10): the mutation uses `scope: { id: pollId }`, so TanStack runs one poll's votes one after another in click order. The server therefore sees them in the order they were clicked, and a slow early request can't land after a later one.
  - **Failure** (AC 17): `onError` restores that mutation's snapshot and calls `toast.error("Your vote didn't go through, try again")` (sonner is already set up).
  - **Settling** (AC 15): `onSettled` invalidates `quackKeys.all()` once no other vote for that poll is still queued, so the feed ends on server numbers. Refetch on focus is already on.
- **Composer** (`QuackForm.tsx`):
  - An "Add poll" button (`variant="ghost"`) reveals answer inputs through `useFieldArray`, starting with 2 inputs.
  - "Add answer" stops showing at 4. Each answer past the second has a remove button with an `aria-label`.
  - "Remove poll" hides the poll and drops it from the submitted body (AC 2).
  - The zod rules match the server's (2–4 answers, 1–80 characters, trimmed, no case-insensitive duplicates), and messages appear under the field.
  - Every answer input has a visible label ("Answer 1"…), per DESIGN.md.
- **No new shadcn components needed**: `button`, `input`, `label`, `form` and `sonner` are already in the kit.

## Build order

Each step ends green on `pnpm check-all` and could be its own commit.

1. **Schema, migration, seed.** Add the three models and back-relations, run the migration, and add the seed poll.
2. **Read path, backend.** Extend the `Quack` domain type with `poll`, the repository `include`, the mapper and `QuackResponseDto`, and pass the viewer into `list`.
   - Tests: counts and `myVoteOptionId` are mapped correctly, a quack without a poll gives `null`, and the search `where` is unchanged.
3. **Create path, backend.** Add `poll` to `CreateQuackDto` with validation, plus the nested create.
   - Tests: 1 answer and 5 answers are rejected; empty, 81-character and case-insensitive duplicate answers are rejected; a quack without a poll still works.
4. **Vote endpoint, backend.** Add the `poll` module with the `PUT /api/polls/:pollId/vote` upsert, the `404`/`400` cases and the `P2002` retry.
   - Tests: a first vote; a change of vote leaves one row and moves the count; repeating the same vote is a no-op; the author can vote; an answer from another poll gives `400`; an unknown poll gives `404`.
5. **Show polls, frontend.** Add the zod schema and `QuackPoll` as read-only (counts, bars, total, your pick).
   - Tests: rendering with 0 and some votes, your pick is marked, a quack without a poll shows no poll.
6. **Vote, frontend.** Add `useVote` with the optimistic update, serial scope, rollback and toast, and wire it into `QuackPoll`.
   - Tests: the count moves before the server answers; a failure restores the counts and shows the toast; clicking your current answer sends no request.
7. **Compose, frontend.** Add "Add poll" / "Remove poll" and the answer fields to `QuackForm`.
   - Tests: the validation messages, the body sent with and without a poll, and "Remove poll" really drops it.
8. **Check-all and hand-off.** Run `pnpm check-all`, then give you a short checklist to try in the running app (post a poll, vote, switch, vote from a second user, force a failure).

Backend first means every frontend step builds against a real, tested API instead of a guess.

## Open points for review

None of these block the build. Say if you disagree:

- Duplicate answers are compared trimmed and ignoring case.
- When several votes for one poll are queued and an _earlier_ one fails, its rollback briefly shows the state before that click. The queued later vote then runs and the final refetch corrects it. Fixing this properly would add complexity the first version doesn't need.
