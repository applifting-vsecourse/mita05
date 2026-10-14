import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { quackMoodDisplay, quackMoods } from "@/lib/quackMoods"
import { cn } from "@/lib/utils"

import type { Profile } from "@/features/profile/api/profileSchemas"
import { isUsernameTakenError, useUpdateProfile } from "@/features/profile/hooks/useUpdateProfile"

// Mirrors the server-side DTO, which validates independently.
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 30
const NAME_MAX_LENGTH = 50
const BIO_MAX_LENGTH = 160

// The mood picker needs a value for "no mood"; the API uses null.
const NO_MOOD = "none"

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
    .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_.]+$/, "Use only letters, numbers, dots and underscores"),
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`),
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Keep it under ${BIO_MAX_LENGTH} characters`),
  defaultMood: z.enum([NO_MOOD, ...quackMoods]),
})

type FormValues = z.infer<typeof schema>

const toFormValues = (profile: Profile): FormValues => ({
  username: profile.username,
  name: profile.name,
  bio: profile.bio ?? "",
  defaultMood: profile.defaultMood ?? NO_MOOD,
})

const moodOptions = [
  { value: NO_MOOD, emoji: null, label: "None" },
  ...quackMoods.map((mood) => ({ value: mood, ...quackMoodDisplay[mood] })),
]

type ProfileFormProps = { profile: Profile }

export function ProfileForm({ profile }: ProfileFormProps) {
  const updateProfile = useUpdateProfile()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
  })

  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    updateProfile.mutate(
      {
        username: values.username,
        name: values.name,
        bio: values.bio || null,
        defaultMood: values.defaultMood === NO_MOOD ? null : values.defaultMood,
      },
      {
        onSuccess: (saved) => {
          // The saved values become the new baseline for "Discard changes".
          form.reset(toFormValues(saved))
          toast.success("Settings saved")
        },
        onError: (error) => {
          // Keep what was typed, and say why right under the field.
          if (isUsernameTakenError(error)) {
            form.setError("username", { message: "That username is already taken" })
          }
        },
      },
    )
  }

  const handleDiscard = () => {
    form.reset()
    updateProfile.reset()
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-6"
      >
        {updateProfile.error && !isUsernameTakenError(updateProfile.error) ? (
          <Alert variant="destructive">
            <AlertDescription>{updateProfile.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} letters, numbers, dots or underscores.
                Saved in lowercase.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between gap-3">
                <FormLabel>Bio</FormLabel>
                <span
                  className={cn(
                    "text-sm",
                    bioLength > BIO_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {bioLength}/{BIO_MAX_LENGTH}
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="e.g. Professional bread enthusiast."
                  {...field}
                />
              </FormControl>
              <FormDescription>Optional.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultMood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default mood</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  aria-label="Default mood"
                  className="flex-wrap"
                  value={field.value}
                  // "None" is an explicit choice, so clicking the selected mood doesn't clear it.
                  onValueChange={(value) => {
                    if (value) field.onChange(value)
                  }}
                >
                  {moodOptions.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className="px-3"
                    >
                      {option.emoji ? <span aria-hidden="true">{option.emoji}</span> : null}
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormDescription>New quacks start with this mood selected.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={!form.formState.isDirty || updateProfile.isPending}
          >
            Discard changes
          </Button>
        </div>
      </form>
    </Form>
  )
}
