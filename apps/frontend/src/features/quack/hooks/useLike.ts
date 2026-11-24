import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { applyLike, applyLikesInFeed } from "@/features/quack/api/applyLikes"
import { likeQuack, unlikeQuack, type LikeSummary } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

export const LIKE_FAILED_MESSAGE = "Your like didn't go through, try again"

// Every cached feed — each search is cached separately — so the quack looks
// the same whichever list it's showing in.
function updateLikesInFeeds(
  queryClient: QueryClient,
  quackId: string,
  update: (likes: LikeSummary) => LikeSummary,
) {
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
    quacks ? applyLikesInFeed(quacks, quackId, update) : quacks,
  )
}

/** Likes (`isLiked: true`) or takes back the like on a quack or reply, with an instant update. */
export function useLike(quackId: string) {
  const queryClient = useQueryClient()
  const mutationKey = quackKeys.like(quackId)
  // Called from onSuccess/onSettled, where the finishing request still counts as pending.
  const isLastQueuedLike = () => queryClient.isMutating({ mutationKey }) === 1

  return useMutation({
    mutationKey,
    // Likes for one quack run one at a time, in click order, so the last click wins.
    scope: { id: mutationKey.join(":") },
    mutationFn: ({ isLiked }: { isLiked: boolean }) =>
      isLiked ? likeQuack(quackId) : unlikeQuack(quackId),
    // Runs on click, before the request waits its turn, so every click shows at once.
    onMutate: async ({ isLiked }) => {
      await queryClient.cancelQueries({ queryKey: quackKeys.lists() })
      const snapshot = queryClient.getQueriesData<Quack[]>({ queryKey: quackKeys.lists() })
      updateLikesInFeeds(queryClient, quackId, (likes) => applyLike(likes, isLiked))
      return { snapshot }
    },
    onError: (_error, _request, context) => {
      // Back to how the feed looked just before this click.
      for (const [queryKey, quacks] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, quacks)
      }
      toast.error(LIKE_FAILED_MESSAGE)
    },
    onSuccess: (serverLikes) => {
      // A later click is still queued: keep showing it rather than this older answer.
      if (isLastQueuedLike()) updateLikesInFeeds(queryClient, quackId, () => serverLikes)
    },
    onSettled: async () => {
      if (isLastQueuedLike()) await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
