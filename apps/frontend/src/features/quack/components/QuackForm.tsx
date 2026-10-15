import { zodResolver } from "@hookform/resolvers/zod"
import { ListPlus, Loader2, X } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { quackMoodDisplay, quackMoods, type QuackMood } from "@/lib/quackMoods"
import { cn } from "@/lib/utils"

import {
  emptyPoll,
  MAX_LENGTH,
  quackFormSchema,
  type QuackFormInput,
  type QuackFormValues,
} from "@/features/quack/components/quackFormSchema"
import { QuackPollFields } from "@/features/quack/components/QuackPollFields"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

type QuackFormProps = {
  className?: string
  /** Preselected for every new quack, including the next one after posting. */
  defaultMood?: QuackMood
}

export function QuackForm({ className, defaultMood }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<QuackFormInput, unknown, QuackFormValues>({
    resolver: zodResolver(quackFormSchema),
    defaultValues: { text: "", mood: defaultMood, poll: undefined },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0
  const hasPoll = useWatch({ control: form.control, name: "poll" }) !== undefined

  // One button that flips between "Add poll" and "Remove poll", so focus stays on it.
  const togglePoll = () => {
    form.setValue("poll", hasPoll ? undefined : emptyPoll())
    form.clearErrors("poll")
  }

  const handleSubmit = (values: QuackFormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        mood: values.mood,
        // Without a poll the request is exactly what it was before polls existed.
        ...(values.poll
          ? { poll: { options: values.poll.options.map(({ value }) => value) } }
          : {}),
      },
      { onSuccess: () => form.reset({ text: "", mood: defaultMood, poll: undefined }) },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New quack</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Quack something..."
                  disabled={addQuack.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={addQuack.isPending}
          onClick={togglePoll}
        >
          {hasPoll ? <X /> : <ListPlus />}
          {hasPoll ? "Remove poll" : "Add poll"}
        </Button>

        {hasPoll ? <QuackPollFields isDisabled={addQuack.isPending} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem className="flex flex-wrap items-center gap-2">
                <FormLabel className="text-sm text-muted-foreground">Mood</FormLabel>
                <FormControl>
                  {/* Optional: clicking the selected mood again clears it. */}
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    aria-label="Mood"
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                    disabled={addQuack.isPending}
                  >
                    {quackMoods.map((mood) => (
                      <ToggleGroupItem
                        key={mood}
                        value={mood}
                        className="px-3"
                      >
                        <span aria-hidden="true">{quackMoodDisplay[mood].emoji}</span>
                        {quackMoodDisplay[mood].label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm",
                length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {length}/{MAX_LENGTH}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={addQuack.isPending}
            >
              {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Quack
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
