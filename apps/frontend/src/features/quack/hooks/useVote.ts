import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { applyVote } from "@/features/quack/api/applyVote"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { votePoll } from "@/features/quack/api/votePoll"

export const VOTE_FAILED_MESSAGE = "Your vote didn't go through, try again"

// Every cached feed — each search is cached separately — so the poll looks
// the same whichever list it's showing in.
function updatePollInFeeds(queryClient: QueryClient, pollId: string, update: (poll: Poll) => Poll) {
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
    quacks?.map((quack) =>
      quack.poll?.id === pollId ? { ...quack, poll: update(quack.poll) } : quack,
    ),
  )
}

export function useVote(pollId: string) {
  const queryClient = useQueryClient()
  const mutationKey = quackKeys.vote(pollId)
  // Called from onSuccess/onSettled, where the finishing vote still counts as pending.
  const isLastQueuedVote = () => queryClient.isMutating({ mutationKey }) === 1

  return useMutation({
    mutationKey,
    // Votes for one poll run one at a time, in click order, so the server
    // sees them in that order and the last click wins.
    scope: { id: mutationKey.join(":") },
    mutationFn: (optionId: string) => votePoll({ pollId, optionId }),
    // Runs on click, before the request waits its turn, so every click shows at once.
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey: quackKeys.lists() })
      const snapshot = queryClient.getQueriesData<Quack[]>({ queryKey: quackKeys.lists() })
      updatePollInFeeds(queryClient, pollId, (poll) => applyVote(poll, optionId))
      return { snapshot }
    },
    onError: (_error, _optionId, context) => {
      // Back to how the feed looked just before this click.
      for (const [queryKey, quacks] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, quacks)
      }
      toast.error(VOTE_FAILED_MESSAGE)
    },
    onSuccess: (serverPoll) => {
      // A later click is still queued: keep showing it rather than this older answer.
      if (isLastQueuedVote()) updatePollInFeeds(queryClient, pollId, () => serverPoll)
    },
    onSettled: async () => {
      if (isLastQueuedVote()) await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
