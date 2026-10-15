import { Plus, X } from "lucide-react"
import { useFieldArray, useFormContext } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

import {
  POLL_MAX_ANSWERS,
  POLL_MIN_ANSWERS,
  type QuackFormInput,
  type QuackFormValues,
} from "@/features/quack/components/quackFormSchema"

const EXAMPLES = ["Pizza", "Thai", "Salad bar", "Sushi"]

type QuackPollFieldsProps = { isDisabled?: boolean }

/** The answers of a poll being written. The quack text is its question. */
export function QuackPollFields({ isDisabled }: QuackPollFieldsProps) {
  const form = useFormContext<QuackFormInput, unknown, QuackFormValues>()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "poll.options" })
  const optionsError = form.formState.errors.poll?.options

  const removeAnswer = (index: number) => {
    remove(index)
    // Keep focus in the poll instead of dropping it to the page.
    form.setFocus(`poll.options.${Math.max(0, index - 1)}.value`)
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Poll answers</legend>

      {fields.map((field, index) => (
        <FormField
          key={field.id}
          control={form.control}
          name={`poll.options.${index}.value`}
          render={({ field: input }) => (
            <FormItem>
              <FormLabel>Answer {index + 1}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    placeholder={EXAMPLES[index]}
                    disabled={isDisabled}
                    {...input}
                  />
                </FormControl>
                {fields.length > POLL_MIN_ANSWERS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove answer ${index + 1}`}
                    disabled={isDisabled}
                    onClick={() => removeAnswer(index)}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}

      {/* Count rules only, which the buttons already prevent; shown in case. */}
      {(optionsError?.root?.message ?? optionsError?.message) ? (
        <p className="text-sm text-destructive">
          {optionsError.root?.message ?? optionsError.message}
        </p>
      ) : null}

      {fields.length < POLL_MAX_ANSWERS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={isDisabled}
          onClick={() => append({ value: "" })}
        >
          <Plus />
          Add answer
        </Button>
      ) : null}
    </fieldset>
  )
}
