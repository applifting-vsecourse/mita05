import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, User as PrismaUser } from '@/generated/prisma/client';
import {
  normalizeUsername,
  Profile,
  ProfileUpdate,
  UsernameTakenError,
} from '@/modules/profile/domain/profile';
import { Injectable } from '@nestjs/common';

const mapPrismaUserToProfile = (user: PrismaUser): Profile => ({
  id: user.id,
  name: user.name,
  username: user.username ?? '',
  bio: user.bio,
  defaultMood: user.defaultMood,
});

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapPrismaUserToProfile(user) : null;
  }

  /** Case-insensitive, so older mixed-case usernames still count as taken. */
  async isUsernameTaken(
    username: string,
    exceptUserId: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        id: { not: exceptUserId },
      },
      select: { id: true },
    });
    return user !== null;
  }

  /** Throws UsernameTakenError if another user claims the username in the meantime. */
  async updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: update.name,
          username: normalizeUsername(update.username),
          displayUsername: update.username,
          bio: update.bio,
          defaultMood: update.defaultMood,
        },
      });
      return mapPrismaUserToProfile(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UsernameTakenError(update.username);
      }
      throw error;
    }
  }
}
