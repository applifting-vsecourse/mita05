export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, isMine = false) => [...quackKeys.lists(), { search, isMine }] as const,
  // A mutation key, not a query key: lets useVote count the votes still queued for one poll.
  vote: (pollId: string) => [...quackKeys.all(), "vote", pollId] as const,
}
