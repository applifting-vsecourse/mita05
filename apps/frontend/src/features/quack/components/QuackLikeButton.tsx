import { Heart } from "lucide-react"

import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

import type { LikeSummary } from "@/features/quack/api/likeQuack"
import { useLike } from "@/features/quack/hooks/useLike"

type QuackLikeButtonProps = {
  /** The quack or reply to like. */
  quackId: string
  likes: LikeSummary
  className?: string
}

/** A toggle showing the like count and whether the signed-in user liked it. */
export function QuackLikeButton({ quackId, likes, className }: QuackLikeButtonProps) {
  const { mutate } = useLike(quackId)

  return (
    <Toggle
      size="sm"
      aria-label="Like"
      pressed={likes.likedByMe}
      onPressedChange={(isPressed) => mutate({ isLiked: isPressed })}
      className={cn("px-2 text-muted-foreground tabular-nums", className)}
    >
      <Heart className={cn(likes.likedByMe && "fill-current")} />
      {likes.likeCount}
    </Toggle>
  )
}
