import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"

import { useSession } from "@/features/auth/hooks/useSession"
import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import {
  quackFeedFilters,
  QuackFeedTabs,
  type QuackFeedFilter,
} from "@/features/quack/components/QuackFeedTabs"
import { focusQuackComposer, QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"

const quacksSearchParamsSchema = z.object({
  // The router parses ?q=2026 as a number, so accept that and treat it as text.
  q: z.union([z.string(), z.number()]).transform(String).optional(),
  // An unknown value in a hand-edited URL falls back to All instead of an error page.
  filter: z.enum(quackFeedFilters).optional().catch(undefined),
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
  const searchParams = Route.useSearch()
  const search = searchParams.q?.trim() ?? ""
  const filter = searchParams.filter ?? "all"
  const isMine = filter === "mine"
  const navigate = Route.useNavigate()
  const quacksQuery = useQuery(quacksQueryOptions(search, isMine))
  const defaultMood = useQuery(profileQueryOptions()).data?.defaultMood ?? undefined
  const viewerId = useSession().user?.id

  // Replace rather than push, so typing doesn't add a history entry per search.
  const setSearch = useCallback(
    (next: string) =>
      void navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true }),
    [navigate],
  )

  // A tab switch is a step the back button should undo, so this one pushes.
  const setFilter = (next: QuackFeedFilter) =>
    void navigate({ search: (prev) => ({ ...prev, filter: next === "all" ? undefined : next }) })

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

        <QuackFeedTabs
          filter={filter}
          onFilterChange={setFilter}
        >
          <QuackList
            quacks={quacksQuery.data ?? []}
            isLoading={quacksQuery.isLoading}
            error={quacksQuery.error ?? undefined}
            // Only the error state offers a retry — posting invalidates the list,
            // and refocusing the tab refetches it.
            onReload={() => void quacksQuery.refetch()}
            search={search}
            onClearSearch={() => setSearch("")}
            viewerId={viewerId}
            isMine={isMine}
            onWriteFirstQuack={focusQuackComposer}
          />
        </QuackFeedTabs>
      </section>
    </>
  )
}
