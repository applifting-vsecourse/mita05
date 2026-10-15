import { z } from "zod"

import { quackMoodSchema } from "@/lib/quackMoods"

// Mirrors the server-side DTOs so the user is told before the request is
// made — the server still validates independently.
export const MAX_LENGTH = 280
export const POLL_MIN_ANSWERS = 2
export const POLL_MAX_ANSWERS = 4
export const POLL_ANSWER_MAX_LENGTH = 80

/** Same rule as the server: answers match after trimming and ignoring case. */
const normaliseAnswer = (answer: string) => answer.trim().toLowerCase()

// useFieldArray needs objects, so each answer is { value }.
const pollSchema = z
  .object({
    options: z
      .array(
        z.object({
          value: z
            .string()
            .trim()
            .min(1, "Write an answer")
            .max(POLL_ANSWER_MAX_LENGTH, `Keep answers under ${POLL_ANSWER_MAX_LENGTH} characters`),
        }),
      )
      .min(POLL_MIN_ANSWERS, `A poll needs at least ${POLL_MIN_ANSWERS} answers`)
      .max(POLL_MAX_ANSWERS, `A poll can have at most ${POLL_MAX_ANSWERS} answers`),
  })
  .superRefine(({ options }, ctx) => {
    // The message goes on the repeat, under its own field, not on the first one.
    const seen = new Set<string>()
    options.forEach(({ value }, index) => {
      const key = normaliseAnswer(value)
      if (!key) return
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "value"],
          message: "This answer is already in the poll",
        })
      }
      seen.add(key)
    })
  })

export const quackFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: quackMoodSchema.optional(),
  /** Absent unless the user added a poll. */
  poll: pollSchema.optional(),
})

export type QuackFormInput = z.input<typeof quackFormSchema>
export type QuackFormValues = z.output<typeof quackFormSchema>

export const emptyPoll = (): NonNullable<QuackFormInput["poll"]> => ({
  options: Array.from({ length: POLL_MIN_ANSWERS }, () => ({ value: "" })),
})
