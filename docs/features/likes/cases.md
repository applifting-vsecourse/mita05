# Likes on quacks: test cases

> "People want to show they like a quack without having to reply. I want a like
> button and a like count on every quack. Everyone can like a quack only once,
> and take the like back." (product owner)

We write these cases before any code. Each case becomes one test. How the count is stored, whether it's counted from a likes table or kept as a stored number, is left out on purpose and will be decided in an ADR.

## Decisions behind the cases

| Question                                 | Decision                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Can I like my own quack?                 | Yes.                                                                                                                    |
| Signed-out visitors                      | They already can't see the feed (`GET /api/quacks` answers 401). Like and unlike without a session also answer **401**. |
| Replies                                  | Can be liked, the same as top-level quacks.                                                                             |
| Deleted quack                            | Like or unlike answers **404**. A fully removed quack takes its likes with it.                                          |
| Tombstone (deleted quack with replies)   | Like or unlike answers **404**. Its likes are erased along with its content. It shows no like button and no count.      |
| Unknown quack id                         | **404**.                                                                                                                |
| What I see                               | The button is a toggle showing whether _I_ liked the quack (`aria-pressed`). A count of 0 is shown as "0".              |
| Clicking                                 | The count and button update straight away. If the server refuses, both go back to how they were and an error is shown.  |
| Liking twice, or unliking when not liked | Nothing happens and the request succeeds. Both requests can be repeated safely.                                         |
| Whose like                               | Always the user from the session, never a user named in the URL or body. Nobody can remove someone else's like.         |
| Two requests at the same moment          | Still one like per person per quack, enforced by the database.                                                          |
| Deleted account                          | That user's likes disappear from every count.                                                                           |

API shape these cases assume:

- `PUT /api/quacks/:quackId/like` likes the quack. `DELETE /api/quacks/:quackId/like` takes the like back.
- Both answer `200` with `{ likeCount, likedByMe }`.
- Every quack and reply in `GET /api/quacks` carries `likeCount` and `likedByMe`. A tombstone carries neither.

Users in the examples: **Alice** and **Bob**, both signed in unless a case says otherwise.

---

## 1. Rules (unit tests)

### Backend: service (`QuacksService` or a likes service, repository faked)

**R1. Liking a quack counts it once**

- Given a quack with 0 likes
- When Alice likes it
- Then its like count is 1 and it is liked by Alice

**R2. Liking again changes nothing**

- Given a quack Alice has liked (count 1)
- When Alice likes it again
- Then the count is still 1 and no error is raised

**R3. Taking the like back removes it**

- Given a quack Alice has liked (count 1)
- When Alice takes her like back
- Then the count is 0 and it is not liked by Alice

**R4. Taking back a like you never gave changes nothing**

- Given a quack with 0 likes that Alice has not liked
- When Alice takes her like back
- Then the count is still 0 and no error is raised

**R5. You can like your own quack**

- Given a quack written by Alice
- When Alice likes it
- Then the count is 1

**R6. A reply can be liked**

- Given a reply to a quack
- When Alice likes the reply
- Then the reply's count is 1
- And the parent quack's count is unchanged

**R7. Each person counts once**

- Given a quack with 0 likes
- When Alice likes it and then Bob likes it
- Then the count is 2

**R8. Taking back your like leaves other people's likes alone**

- Given a quack liked by Alice and Bob (count 2)
- When Alice takes her like back
- Then the count is 1
- And it is still liked by Bob

**R9. "Liked by me" depends on who is asking**

- Given a quack liked by Alice only
- When Alice reads it, and Bob reads it
- Then both see a count of 1
- And Alice sees it as liked by her, while Bob sees it as not liked by him

**R10. You can't like a quack that doesn't exist**

- Given no quack with id `nope`
- When Alice likes `nope`, or takes back a like on `nope`
- Then the service raises "quack not found"

**R11. You can't like a deleted quack**

- Given a quack that was fully deleted (it had no replies)
- When Alice likes it, or takes back a like on it
- Then the service raises "quack not found"

**R12. You can't like a tombstone**

- Given a quack with replies that was deleted, so it is now a tombstone
- When Alice likes it, or takes back a like on it
- Then the service raises "quack not found"

**R13. Deleting a quack with replies erases its likes**

- Given a quack with a reply, liked by Alice and Bob
- When its author deletes it, so it becomes a tombstone
- Then the tombstone has no likes and exposes no like count

### Frontend: components and hooks (Vitest + Testing Library)

**F1. Every quack shows its count, including 0**

- Given a quack with `likeCount: 0`
- When the feed renders
- Then its like button shows "0"

**F2. The button shows my own like**

- Given a quack with `likedByMe: true`
- When it renders
- Then the like button has `aria-pressed="true"`
- And given `likedByMe: false`, it has `aria-pressed="false"`

**F3. Clicking updates straight away**

- Given a quack with count 0, not liked by me
- When I click the like button, before the server answers
- Then the button shows 1 and is pressed

**F4. Clicking a liked quack takes the like back**

- Given a quack with count 1, liked by me
- When I click the like button
- Then the button shows 0, is not pressed, and an unlike request is sent

**F5. A refused request rolls back**

- Given a quack with count 0, not liked by me
- When I click like and the server answers with an error
- Then the button goes back to 0 and not pressed
- And an error message is shown

**F6. Replies have a like button too**

- Given a quack with a reply that has `likeCount: 2`
- When the replies render
- Then the reply has its own like button showing "2"

**F7. Tombstones have no like button**

- Given a tombstone in the feed
- When it renders
- Then it shows neither a like button nor a count

---

## 2. API behaviour (integration tests, real HTTP and database)

Each case asserts the **HTTP status** plus the body or the follow-up `GET /api/quacks`.

**A1. Like**

- Given Alice is signed in and quack Q has 0 likes
- When she sends `PUT /api/quacks/Q/like`
- Then the response is `200 { likeCount: 1, likedByMe: true }`
- And `GET /api/quacks` shows Q with `likeCount: 1, likedByMe: true`

**A2. Like twice**

- Given Alice has liked Q
- When she sends `PUT /api/quacks/Q/like` again
- Then the response is `200 { likeCount: 1, likedByMe: true }`

**A3. Unlike**

- Given Alice has liked Q (count 1)
- When she sends `DELETE /api/quacks/Q/like`
- Then the response is `200 { likeCount: 0, likedByMe: false }`

**A4. Unlike without having liked**

- Given Alice has not liked Q (count 0)
- When she sends `DELETE /api/quacks/Q/like`
- Then the response is `200 { likeCount: 0, likedByMe: false }`

**A5. Signed out**

- Given no session, and Q liked by Bob (count 1)
- When the client sends `PUT /api/quacks/Q/like`, and then `DELETE /api/quacks/Q/like`
- Then both answer `401`
- And Bob, reading the feed, still sees Q with `likeCount: 1, likedByMe: true`

**A6. Unknown quack**

- Given no quack with id `nope`
- When Alice sends `PUT /api/quacks/nope/like`, and `DELETE /api/quacks/nope/like`
- Then both answer `404`

**A7. Fully deleted quack**

- Given Alice's quack Q with no replies, liked by Bob, which Alice then deletes
- When Bob sends `PUT /api/quacks/Q/like`, and `DELETE /api/quacks/Q/like`
- Then both answer `404`

**A8. Tombstone**

- Given quack Q with a reply, liked by Alice and Bob, which its author then deletes
- When Alice sends `PUT /api/quacks/Q/like`, and `DELETE /api/quacks/Q/like`
- Then both answer `404`
- And `GET /api/quacks` shows the tombstone with no `likeCount` and no `likedByMe`, while its reply keeps its own likes

**A9. Own quack**

- Given quack Q written by Alice
- When Alice sends `PUT /api/quacks/Q/like`
- Then the response is `200 { likeCount: 1, likedByMe: true }`

**A10. Reply**

- Given reply R under quack Q
- When Alice sends `PUT /api/quacks/R/like`
- Then the response is `200 { likeCount: 1, likedByMe: true }`
- And `GET /api/quacks` shows R with `likeCount: 1` and Q with `likeCount: 0`

**A11. Two people**

- Given Q with 0 likes
- When Alice and Bob each send `PUT /api/quacks/Q/like`
- Then Bob's response is `200 { likeCount: 2, likedByMe: true }`

**A12. You can't take back someone else's like**

- Given Q liked by Alice only (count 1)
- When Bob sends `DELETE /api/quacks/Q/like`
- Then the response is `200 { likeCount: 1, likedByMe: false }`
- And Alice still sees `likedByMe: true`

**A13. The user comes from the session, never the body**

- Given Q liked by Alice only
- When Bob sends `DELETE /api/quacks/Q/like` with body `{ "userId": "<Alice's id>" }`
- Then the response is `400`, because unknown fields are refused
- And Alice's like is still there (count 1)

**A14. "Liked by me" per viewer in the feed**

- Given Q liked by Alice only
- When Alice and Bob each `GET /api/quacks`
- Then both see `likeCount: 1`
- And Alice sees `likedByMe: true`, while Bob sees `likedByMe: false`

**A15. Two requests at the same moment**

- Given Q with 0 likes
- When Alice sends two `PUT /api/quacks/Q/like` requests at the same time
- Then both answer `200`
- And `GET /api/quacks` shows Q with `likeCount: 1`

**A16. Deleted account**

- Given Q liked by Alice and Bob (count 2)
- When Bob's account is deleted
- Then Alice's `GET /api/quacks` shows Q with `likeCount: 1`

**A17. Deleting a liked quack works**

- Given Alice's quack Q with no replies, liked by Bob
- When Alice sends `DELETE /api/quacks/Q`
- Then the response is `204` and Q is gone from the feed, so likes don't block deletion

---

## 3. End-to-end flows (Playwright)

Following CLAUDE.md, each step that changes a like waits for the request and asserts its **HTTP status**, not only what's on the screen. Review each test by switching the server check off: the test must fail.

**E1. Like and take it back** (the product owner's examples)

- Given Alice is signed in and sees her new quack with like count "0" and the button not pressed
- When she clicks Like
- Then the `PUT …/like` request answers `200`, the count shows "1" and the button is pressed
- When she reloads the page
- Then the count is still "1" and pressed
- When she clicks Like again
- Then the `DELETE …/like` request answers `200`, the count shows "0" and the button is not pressed
- When she reloads
- Then the count is still "0"

**E2. Two people**

- Given Alice has liked quack Q
- When Bob signs in
- Then he sees Q with count "1" and the button not pressed
- When Bob clicks Like
- Then the request answers `200` and he sees "2", pressed
- When Alice takes her like back and Bob reloads
- Then Bob sees "1", still pressed

**E3. Signed out can't like** (permission check on the server's answer)

- Given quack Q liked by Alice (count 1)
- When a client with no session sends `PUT /api/quacks/Q/like` and `DELETE /api/quacks/Q/like`
- Then both answer `401`
- And Alice, signed in, still sees "1", pressed

**E4. Tombstone**

- Given Alice's quack has a reply from Bob and a like from Bob
- When Alice deletes her quack
- Then the placeholder shows no like button and no count
- And Bob's reply under it still shows its own like button
