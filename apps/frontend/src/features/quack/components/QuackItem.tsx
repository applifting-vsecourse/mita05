import { useState } from "react"
import { MessageCircle } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date"

import type { Quack, Reply } from "@/features/quack/api/quackSchemas"
import { DeleteQuackButton } from "@/features/quack/components/DeleteQuackButton"
import { QuackMoodLabel } from "@/features/quack/components/QuackMoodLabel"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { ReplyForm } from "@/features/quack/components/ReplyForm"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: Quack
  /** The signed-in user: they may delete what they wrote. The server checks this again. */
  viewerId?: string
  /** The viewer is a moderator, who may delete anything. The server checks this again. */
  isAdmin?: boolean
  /** Shows the Reply button. Off for static previews such as the landing page. */
  canReply?: boolean
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

export function QuackItem({ quack, viewerId, isAdmin, canReply }: QuackItemProps) {
  const [isReplying, setIsReplying] = useState(false)
  const canDelete = (authorId: string | null) =>
    isAdmin === true || (viewerId !== undefined && authorId === viewerId)
  const hasThread = quack.replies.length > 0 || isReplying

  return (
    <article className="flex w-full flex-col gap-3 border-b border-border pt-2 pb-4 last:border-b-0">
      {quack.isDeleted ? (
        // Only a placeholder for its replies: no author, mood, time or content.
        <div className="flex gap-4">
          <div
            aria-hidden="true"
            className="size-12 shrink-0"
          />
          <p className="flex-1 py-3 text-sm text-muted-foreground italic">This quack was deleted</p>
        </div>
      ) : (
        <div className="flex gap-4">
          <Avatar className="size-12">
            <AvatarFallback>{initialsOf(quack.user.name)}</AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span>
                <UsersName name={quack.user.name} />{" "}
                <UsersUserName username={quack.user.username} />
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
              {quack.mood ? (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <QuackMoodLabel mood={quack.mood} />
                </>
              ) : null}
            </div>
            <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
            {quack.poll ? (
              <QuackPoll
                poll={quack.poll}
                className="mt-2"
              />
            ) : null}
            {canReply ? (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 text-muted-foreground"
                  aria-expanded={isReplying}
                  onClick={() => setIsReplying((isOpen) => !isOpen)}
                >
                  <MessageCircle />
                  Reply
                </Button>
              </div>
            ) : null}
          </div>

          {canDelete(quack.userId) ? (
            <DeleteQuackButton
              quackId={quack.id}
              hasReplies={quack.replies.length > 0}
            />
          ) : null}
        </div>
      )}

      {hasThread ? (
        <div className="ml-4 flex flex-col gap-3 border-l border-border pl-4 sm:ml-16">
          {quack.replies.length > 0 ? (
            <ul
              aria-label="Replies"
              className="flex flex-col gap-3"
            >
              {quack.replies.map((reply) => (
                <li key={reply.id}>
                  <ReplyItem
                    reply={reply}
                    canDelete={canDelete(reply.userId)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {isReplying ? (
            <ReplyForm
              quackId={quack.id}
              onReplied={() => setIsReplying(false)}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function ReplyItem({ reply, canDelete }: { reply: Reply; canDelete: boolean }) {
  return (
    <article className="flex gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">{initialsOf(reply.user.name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={reply.user.name} /> <UsersUserName username={reply.user.username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</time>
        </div>
        <p className="text-sm break-words whitespace-pre-line">{reply.text}</p>
      </div>

      {canDelete ? (
        <DeleteQuackButton
          quackId={reply.id}
          isReply
        />
      ) : null}
    </article>
  )
}
