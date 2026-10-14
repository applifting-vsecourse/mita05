import { Profile, UsernameTakenError } from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ProfileService } from './profile.service';

const aProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'u1',
  name: 'Caffeinated Duck',
  username: 'caffeinatedduck',
  bio: null,
  defaultMood: null,
  ...overrides,
});

const user = { id: 'u1' } as Identity;

describe('ProfileService', () => {
  it('returns the signed-in user’s profile', async () => {
    const repository = mock<ProfileRepository>();
    repository.getProfile.mockResolvedValue(aProfile());

    const service = new ProfileService(repository);

    await expect(service.getProfile(user)).resolves.toEqual(aProfile());
    expect(repository.getProfile).toHaveBeenCalledWith('u1');
  });

  it('fails when the user no longer exists', async () => {
    const repository = mock<ProfileRepository>();
    repository.getProfile.mockResolvedValue(null);

    const service = new ProfileService(repository);

    await expect(service.getProfile(user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the signed-in user’s profile', async () => {
    const updated = aProfile({ username: 'duck.lover', defaultMood: 'silly' });
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(false);
    repository.updateProfile.mockResolvedValue(updated);

    const service = new ProfileService(repository);

    await expect(
      service.updateProfile(user, {
        name: 'Caffeinated Duck',
        username: 'Duck.Lover',
        bio: 'Mostly bread.',
        defaultMood: 'silly',
      }),
    ).resolves.toEqual(updated);
    expect(repository.updateProfile).toHaveBeenCalledWith('u1', {
      name: 'Caffeinated Duck',
      username: 'Duck.Lover',
      bio: 'Mostly bread.',
      defaultMood: 'silly',
    });
  });

  it('checks availability of the lowercased username, ignoring the user’s own', async () => {
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(false);
    repository.updateProfile.mockResolvedValue(aProfile());

    const service = new ProfileService(repository);

    await service.updateProfile(user, {
      name: 'Caffeinated Duck',
      username: 'Duck.Lover',
      bio: null,
      defaultMood: null,
    });

    expect(repository.isUsernameTaken).toHaveBeenCalledWith('duck.lover', 'u1');
  });

  it('refuses a username someone else has, without saving anything', async () => {
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(true);

    const service = new ProfileService(repository);

    await expect(
      service.updateProfile(user, {
        name: 'Caffeinated Duck',
        username: 'taken',
        bio: null,
        defaultMood: null,
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('stores an emptied bio as no bio', async () => {
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(false);
    repository.updateProfile.mockResolvedValue(aProfile());

    const service = new ProfileService(repository);

    await service.updateProfile(user, {
      name: 'Caffeinated Duck',
      username: 'caffeinatedduck',
      bio: '',
      defaultMood: null,
    });

    expect(repository.updateProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ bio: null }),
    );
  });
});
