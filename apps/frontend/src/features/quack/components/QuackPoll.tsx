import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

import type { Poll } from "@/features/quack/api/quackSchemas"

/** Rounded, so a poll's percentages may add up to 99 or 101. */
export const votePercent = (voteCount: number, totalVotes: number) =>
  totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100)

const votesLabel = (count: number) => (count === 1 ? "1 vote" : `${count} votes`)

type QuackPollProps = { poll: Poll; className?: string }

// Read-only for now: voting turns each answer into a button.
export function QuackPoll({ poll, className }: QuackPollProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul
        aria-label="Poll answers"
        className="flex flex-col gap-2"
      >
        {poll.options.map((option) => {
          const percent = votePercent(option.voteCount, poll.totalVotes)
          const isMine = option.id === poll.myVoteOptionId

          return (
            <li
              key={option.id}
              className="relative overflow-hidden rounded-md border border-border px-3 py-2 text-sm"
            >
              {/* Width is data, not spacing, so it can't come from the scale. */}
              <div
                aria-hidden="true"
                data-slot="poll-bar"
                className="absolute inset-y-0 left-0 bg-secondary"
                style={{ width: `${percent}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-2 break-words",
                    isMine && "font-medium",
                  )}
                >
                  {isMine ? (
                    <Check
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  ) : null}
                  <span className="min-w-0">{option.text}</span>
                  {isMine ? <span className="sr-only">(your vote)</span> : null}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {votesLabel(option.voteCount)} · {percent}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        {poll.totalVotes === 0 ? "No votes yet" : votesLabel(poll.totalVotes)}
      </p>
    </div>
  )
}
