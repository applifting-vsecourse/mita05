import { Poll } from '@/modules/poll/domain/poll';

export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;

export type QuackMood = (typeof QUACK_MOODS)[number];

/**
 * Splits a search query into the words that must all match.
 * A leading "@" is dropped, because usernames are shown as @handle but stored without it.
 */
export const parseSearchTerms = (query: string | undefined): string[] =>
  (query ?? '')
    .split(/\s+/)
    .map((word) => word.replace(/^@+/, ''))
    .filter((word) => word.length > 0);

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

/** A reply under a quack in the feed. Replies are text only: no mood, no poll. */
export type QuackReply = {
  id: string;
  text: string;
  userId: string;
  parentId: string;
  createdAt: Date;
  user?: QuackAuthor;
};

export type Quack = {
  id: string;
  /** Null only on a tombstone. */
  text: string | null;
  mood: QuackMood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  /**
   * A deleted quack kept only as a placeholder for its replies: its text, mood
   * and poll are erased, and its author must never be shown.
   * See docs/adr/0001-deleted-quacks-become-tombstones.md.
   */
  isDeleted: boolean;
  user?: QuackAuthor;
  /** Undefined when not loaded; null when the quack has no poll. */
  poll?: Poll | null;
  /** Undefined when not loaded; oldest first. */
  replies?: QuackReply[];
};

/** What happened to a quack the user asked to delete. */
export type QuackDeletion = 'deleted' | 'tombstoned';

export class QuackNotFoundError extends Error {
  constructor(quackId: string) {
    super(`Quack "${quackId}" does not exist`);
  }
}

/** Replies are one level deep: a reply can't have replies of its own. */
export class CannotReplyToReplyError extends Error {
  constructor(quackId: string) {
    super(
      `Quack "${quackId}" is a reply; reply to the quack it answers instead`,
    );
  }
}

export class QuackNotOwnedError extends Error {
  constructor(quackId: string) {
    super(`Quack "${quackId}" belongs to someone else`);
  }
}
