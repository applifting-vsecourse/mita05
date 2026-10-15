import type { Poll } from "@/features/quack/api/quackSchemas"

/**
 * The poll as it will look once the vote lands: moves the user's vote to
 * `optionId`, or adds it if they hadn't voted. Used for the instant update;
 * the server's counts replace it when the request finishes.
 */
export function applyVote(poll: Poll, optionId: string): Poll {
  const previous = poll.myVoteOptionId
  if (previous === optionId) return poll

  return {
    ...poll,
    options: poll.options.map((option) => {
      if (option.id === optionId) return { ...option, voteCount: option.voteCount + 1 }
      if (option.id === previous) return { ...option, voteCount: Math.max(0, option.voteCount - 1) }
      return option
    }),
    totalVotes: previous === null ? poll.totalVotes + 1 : poll.totalVotes,
    myVoteOptionId: optionId,
  }
}
