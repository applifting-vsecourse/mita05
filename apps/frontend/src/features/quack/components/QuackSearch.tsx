import { useEffect, useId, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Wait for a pause in typing so a quickly typed word sends one request, not one per letter.
export const SEARCH_DELAY_MS = 300

type QuackSearchProps = {
  /** The active search, as it is in the URL. */
  search: string
  /** Called with the trimmed input once typing pauses. */
  onSearchChange: (search: string) => void
  className?: string
}

export function QuackSearch({ search, onSearchChange, className }: QuackSearchProps) {
  const id = useId()
  const [value, setValue] = useState(search)
  // The last search this field sent, to tell its own URL updates from outside ones.
  const [applied, setApplied] = useState(search)
  const [previousSearch, setPreviousSearch] = useState(search)

  // The search changed without this field (e.g. "Clear search" or back/forward), so show it.
  if (search !== previousSearch) {
    setPreviousSearch(search)
    if (search !== applied) {
      setApplied(search)
      if (search !== value.trim()) setValue(search)
    }
  }

  const next = value.trim()
  useEffect(() => {
    if (next === applied) return
    const timeout = setTimeout(() => {
      setApplied(next)
      onSearchChange(next)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [next, applied, onSearchChange])

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>Search quacks</Label>
      <Input
        id={id}
        type="search"
        placeholder="e.g. lunch or @ada"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  )
}
