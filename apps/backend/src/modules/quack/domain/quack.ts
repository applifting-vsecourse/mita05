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

export type Quack = {
  id: string;
  text: string;
  mood: QuackMood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
  /** Undefined when not loaded; null when the quack has no poll. */
  poll?: Poll | null;
};

export class QuackNotFoundError extends Error {
  constructor(quackId: string) {
    super(`Quack "${quackId}" does not exist`);
  }
}

export class QuackNotOwnedError extends Error {
  constructor(quackId: string) {
    super(`Quack "${quackId}" belongs to someone else`);
  }
}
