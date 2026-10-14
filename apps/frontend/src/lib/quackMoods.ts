import { z } from "zod"

// Shared by the quack feed and the profile's default mood, so it lives outside both features.
// Mirrors the backend's QUACK_MOODS. A quack without a mood comes back as null.
export const quackMoods = ["happy", "sad", "angry", "silly"] as const

export const quackMoodSchema = z.enum(quackMoods)

export type QuackMood = z.infer<typeof quackMoodSchema>

export const quackMoodDisplay: Record<QuackMood, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "Happy" },
  sad: { emoji: "😢", label: "Sad" },
  angry: { emoji: "😠", label: "Angry" },
  silly: { emoji: "🤪", label: "Silly" },
}
