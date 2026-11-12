import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

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
import { cn } from "@/lib/utils"

import { replyFormSchema, type ReplyFormValues } from "@/features/quack/components/quackFormSchema"
import { useAddReply } from "@/features/quack/hooks/useAddReply"

type ReplyFormProps = {
  quackId: string
  /** Called once the server has the reply, so the caller can close the form. */
  onReplied?: () => void
  className?: string
}

/** Text and a button, nothing else: replies have no mood and no poll. */
export function ReplyForm({ quackId, onReplied, className }: ReplyFormProps) {
  const addReply = useAddReply()
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: { text: "" },
  })

  // The form opens because the user clicked Reply, so put the cursor where they'll type.
  useEffect(() => {
    form.setFocus("text")
  }, [form])

  const handleSubmit = (values: ReplyFormValues) => {
    addReply.mutate(
      { quackId, text: values.text },
      {
        // On failure the text stays, so nothing typed is lost.
        onSuccess: () => {
          form.reset({ text: "" })
          onReplied?.()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("flex flex-col gap-2", className)}
      >
        {addReply.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your reply</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Quack back..."
                  disabled={addReply.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={addReply.isPending}
          >
            {addReply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Post reply
          </Button>
        </div>
      </form>
    </Form>
  )
}
