import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const quackFeedFilters = ["all", "mine"] as const

export type QuackFeedFilter = (typeof quackFeedFilters)[number]

type QuackFeedTabsProps = {
  filter: QuackFeedFilter
  onFilterChange: (filter: QuackFeedFilter) => void
  /** The feed for the active tab. */
  children: ReactNode
  className?: string
}

export function QuackFeedTabs({ filter, onFilterChange, children, className }: QuackFeedTabsProps) {
  return (
    <Tabs
      value={filter}
      onValueChange={(value) => onFilterChange(value as QuackFeedFilter)}
      className={className}
    >
      <TabsList aria-label="Show quacks">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="mine">Mine</TabsTrigger>
      </TabsList>
      {/* Both tabs show the same list with different data, so one panel follows the active tab. */}
      <TabsContent value={filter}>{children}</TabsContent>
    </Tabs>
  )
}
