import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"

import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"

const quacksSearchParamsSchema = z.object({
  // The router parses ?q=2026 as a number, so accept that and treat it as text.
  q: z.union([z.string(), z.number()]).transform(String).optional(),
})

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
  validateSearch: quacksSearchParamsSchema,
  // The post form reads the default mood once, when it mounts, so have it ready.
  // ensureQueryData reuses the cache, since this loader reruns on every search keystroke.
  // A failure only costs the preselected mood, so it doesn't block the page.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(profileQueryOptions()).catch(() => undefined),
})

function QuacksPage() {
  const search = Route.useSearch().q?.trim() ?? ""
  const navigate = Route.useNavigate()
  const quacksQuery = useQuery(quacksQueryOptions(search))
  const defaultMood = useQuery(profileQueryOptions()).data?.defaultMood ?? undefined

  // Replace rather than push, so typing doesn't add a history entry per search.
  const setSearch = useCallback(
    (next: string) => void navigate({ search: { q: next || undefined }, replace: true }),
    [navigate],
  )

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          className="mb-4"
          defaultMood={defaultMood}
        />

        <QuackSearch
          className="mb-4"
          search={search}
          onSearchChange={setSearch}
        />

        <QuackList
          quacks={quacksQuery.data ?? []}
          isLoading={quacksQuery.isLoading}
          error={quacksQuery.error ?? undefined}
          // Only the error state offers a retry — posting invalidates the list,
          // and refocusing the tab refetches it.
          onReload={() => void quacksQuery.refetch()}
          search={search}
          onClearSearch={() => setSearch("")}
        />
      </section>
    </>
  )
}
