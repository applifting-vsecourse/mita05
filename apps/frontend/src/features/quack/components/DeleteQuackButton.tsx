import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

type DeleteQuackButtonProps = {
  /** The quack or reply to delete. */
  quackId: string
  /** It's a reply, not a quack in the feed. */
  isReply?: boolean
  /** The quack has replies, so it stays as a placeholder instead of disappearing. */
  hasReplies?: boolean
}

const describeDeletion = ({ isReply, hasReplies }: Omit<DeleteQuackButtonProps, "quackId">) => {
  if (isReply) return "It disappears for everyone. This can't be undone."
  if (hasReplies) {
    return "Its text and poll are erased for everyone. The replies stay, under a note that the quack was deleted. This can't be undone."
  }
  return "It disappears from the feed for everyone, poll included. This can't be undone."
}

/**
 * Asks first, then deletes. Only render it on the viewer's own quacks and replies,
 * or on any of them for an admin.
 */
export function DeleteQuackButton({ quackId, isReply, hasReplies }: DeleteQuackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteQuack = useDeleteQuack()

  const handleOpenChange = (isOpening: boolean) => {
    // Stay open while the delete runs, so a failure has somewhere to show.
    if (deleteQuack.isPending) return
    // A fresh attempt shouldn't start with the last one's error.
    if (isOpening) deleteQuack.reset()
    setIsOpen(isOpening)
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isReply ? "Delete reply" : "Delete quack"}
          className="text-muted-foreground"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isReply ? "Delete this reply?" : "Delete this quack?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {describeDeletion({ isReply, hasReplies })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteQuack.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteQuack.isPending}
            onClick={(event) => {
              // The action closes the dialog by default; wait for the server instead.
              event.preventDefault()
              deleteQuack.mutate(quackId, { onSuccess: () => setIsOpen(false) })
            }}
          >
            {deleteQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
