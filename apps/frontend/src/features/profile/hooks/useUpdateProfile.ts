import { useMutation, useQueryClient } from "@tanstack/react-query"

import { HTTPError } from "@/lib/api-client"

import { profileKeys } from "@/features/profile/api/profileKeys"
import { updateProfile } from "@/features/profile/api/updateProfile"

/** The server answers 409 when someone else already has the username. */
export const isUsernameTakenError = (error: unknown) =>
  error instanceof HTTPError && error.response.status === 409

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKeys.me(), profile)
      // The name and @username appear all over the app — the header's session,
      // every quack in the feed — so refetch everything rather than chase each query.
      // Awaited so the new name is on screen by the time the confirmation shows.
      await queryClient.invalidateQueries()
    },
  })
}
