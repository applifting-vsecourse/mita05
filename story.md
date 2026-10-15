# Story: Polls

## Why

People ask questions in quacks ("where do we go for lunch?") and count the replies by hand. The counts end up wrong and the question gets buried under replies. Polls let someone ask a question with a few fixed answers, let everyone pick one, and show correct counts to everyone. This is a first version: we want to see whether people use it, so nothing beyond what's listed here.

## User story

As a signed-in Quacker user, I want to attach a poll to a quack and vote on other people's polls, so that the group can pick an answer without anyone counting replies by hand.

## Acceptance criteria

### Creating a poll

1. A poll is part of a quack. The quack's text is the question, and the poll appears in the normal feed.
2. The post form has an "Add poll" button that shows the answer fields. A "Remove poll" button hides them again, and the quack is then posted without a poll.
3. A poll has 2 to 4 answers, each up to 80 characters. Empty answers and duplicate answers are rejected, both in the form and by the API.
4. A poll quack can still have a mood, like any other quack.
5. Once posted, a poll can't be edited or deleted, the same as quacks today.

### Voting

6. Every signed-in user can vote, including the poll's author.
7. One person, one vote: each user has at most one vote per poll. The server enforces this, not only the UI.
8. A user can change their vote to a different answer at any time.
9. Clicking the answer you already picked does nothing. Once you have voted, you can't remove your vote, only switch it to another answer.
10. If a user clicks quickly between answers, their last click is the vote that counts.
11. Polls have no end date and stay open for voting forever.

### Results

12. Everyone sees the results straight away, whether or not they have voted.
13. Each answer shows its vote count and a percentage bar. The poll shows the total number of votes.
14. Results are anonymous: the app never shows who voted for what. The current user sees a mark on the answer they picked.
15. The counts stored on the server are always correct. Users see up-to-date counts when the feed loads, when they come back to the tab, and after their own vote. Results don't update live while you're looking at them.

### Feel and failure

16. Voting feels instant: the user's choice and the counts update the moment they click, without waiting for the server.
17. If a vote fails, the poll goes back to how it was before the click and a short error message appears, for example: "Your vote didn't go through, try again."

### Search

18. Search matches only the question (the quack text), not the poll answers. Search behaviour doesn't change.

## Out of scope for this version

- Removing a vote
- Closing polls, or setting an end date
- Editing or deleting polls
- Live updates of other people's votes (websockets or polling)
- Seeing who voted for what
- Picking more than one answer
- Searching poll answers
