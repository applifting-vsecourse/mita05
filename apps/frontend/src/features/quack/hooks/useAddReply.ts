import { useMutation, useQueryClient } from "@tanstack/react-query"

import { addReply } from "@/features/quack/api/addReply"
import { quackKeys } from "@/features/quack/api/quackKeys"

// Not optimistic: the reply shows up once the server has it (story AC 8).
export function useAddReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addReply,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
