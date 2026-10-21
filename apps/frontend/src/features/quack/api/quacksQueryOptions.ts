import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

/**
 * An empty search lists every quack; filtering happens on the server.
 * With `isMine`, only the signed-in user's quacks — the server takes "me" from the session.
 */
export const quacksQueryOptions = (search = "", isMine = false) =>
  queryOptions({
    queryKey: quackKeys.list(search, isMine),
    queryFn: async () =>
      quacksSchema.parse(
        await api
          .get("quacks", {
            searchParams: {
              ...(search ? { q: search } : {}),
              ...(isMine ? { author: "me" } : {}),
            },
          })
          .json(),
      ),
    // Keep showing the current list while the next search loads, instead of a spinner per keystroke.
    placeholderData: keepPreviousData,
  })
