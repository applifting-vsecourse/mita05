import { useMutation, useQueryClient } from "@tanstack/react-query"

import { applyDeletion } from "@/features/quack/api/applyDeletion"
import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    onSuccess: async (_data, quackId) => {
      // Update every cached feed at once, so the deleted content doesn't linger
      // until the refetch lands. Works for quacks and replies alike.
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks ? applyDeletion(quacks, quackId) : quacks,
      )
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
