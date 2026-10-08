import type { QuackMood } from "@/features/quack/api/quackSchemas"
import { quackMoodDisplay } from "@/features/quack/lib/quackMoods"

type QuackMoodLabelProps = { mood: QuackMood }

export function QuackMoodLabel({ mood }: QuackMoodLabelProps) {
  const { emoji, label } = quackMoodDisplay[mood]

  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">{emoji}</span> {label}
    </span>
  )
}
