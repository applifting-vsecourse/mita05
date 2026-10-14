import {
  normalizeUsername,
  Profile,
  ProfileUpdate,
  UsernameTakenError,
} from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async getProfile(user: Identity): Promise<Profile> {
    const profile = await this.profileRepository.getProfile(user.id);
    if (!profile) {
      throw new NotFoundException();
    }
    return profile;
  }

  /** Throws UsernameTakenError when someone else already has the username. */
  async updateProfile(user: Identity, update: ProfileUpdate): Promise<Profile> {
    if (
      await this.profileRepository.isUsernameTaken(
        normalizeUsername(update.username),
        user.id,
      )
    ) {
      throw new UsernameTakenError(update.username);
    }
    return this.profileRepository.updateProfile(user.id, {
      name: update.name,
      username: update.username,
      // An emptied bio is stored as no bio.
      bio: update.bio || null,
      defaultMood: update.defaultMood,
    });
  }
}
