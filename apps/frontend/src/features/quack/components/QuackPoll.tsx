import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { useVote } from "@/features/quack/hooks/useVote"

/** Rounded, so a poll's percentages may add up to 99 or 101. */
export const votePercent = (voteCount: number, totalVotes: number) =>
  totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100)

const votesLabel = (count: number) => (count === 1 ? "1 vote" : `${count} votes`)

type QuackPollProps = { poll: Poll; className?: string }

export function QuackPoll({ poll, className }: QuackPollProps) {
  const { mutate: vote } = useVote(poll.id)

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
            <li key={option.id}>
              {/* Stays clickable while a vote is in flight: the last click wins. */}
              <Button
                type="button"
                variant="outline"
                aria-pressed={isMine}
                // Your current answer: nothing to send, and a vote can't be taken back.
                onClick={() => {
                  if (!isMine) vote(option.id)
                }}
                className="relative h-auto w-full justify-start overflow-hidden px-3 py-2 font-normal whitespace-normal"
              >
                {/* Width is data, not spacing, so it can't come from the scale. */}
                <span
                  aria-hidden="true"
                  data-slot="poll-bar"
                  className="absolute inset-y-0 left-0 bg-secondary"
                  style={{ width: `${percent}%` }}
                />
                <span className="relative flex w-full items-center justify-between gap-3 text-left">
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
                </span>
              </Button>
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
