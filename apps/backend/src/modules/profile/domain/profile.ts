import { QuackMood } from '@/modules/quack/domain/quack';

// The same rules BetterAuth's username plugin applies at sign-up.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export const NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;

/**
 * Sign-up stores the username lowercased and keeps the typed form as displayUsername,
 * so "Ada" and "ada" can't both exist. A rename has to follow the same rule.
 */
export const normalizeUsername = (username: string): string =>
  username.toLowerCase();

export type Profile = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  defaultMood: QuackMood | null;
};

export type ProfileUpdate = {
  name: string;
  username: string;
  bio: string | null;
  defaultMood: QuackMood | null;
};

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username "${username}" is already taken`);
  }
}
