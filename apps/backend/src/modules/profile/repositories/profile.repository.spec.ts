// Prisma is mocked, so this does not need a database.
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, User as PrismaUser } from '@/generated/prisma/client';
import { UsernameTakenError } from '@/modules/profile/domain/profile';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ProfileRepository } from './profile.repository';

let prisma: DeepMockProxy<PrismaService>;
let repository: ProfileRepository;

beforeEach(() => {
  prisma = mockDeep<PrismaService>();
  repository = new ProfileRepository(prisma);
});

const update = {
  name: 'Caffeinated Duck',
  username: 'Duck.Lover',
  bio: 'Mostly bread.',
  defaultMood: 'happy' as const,
};

describe('ProfileRepository.isUsernameTaken', () => {
  it('looks for anyone else with the username, ignoring case', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(repository.isUsernameTaken('duck_lover', 'u1')).resolves.toBe(
      false,
    );
    // An exact match, not LIKE — so "_" in the username is not a wildcard.
    expect(prisma.user.findFirst.mock.calls[0][0]?.where).toEqual({
      username: { equals: 'duck_lover', mode: 'insensitive' },
      id: { not: 'u1' },
    });
  });

  it('reports a match as taken', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2' } as PrismaUser);

    await expect(repository.isUsernameTaken('duck', 'u1')).resolves.toBe(true);
  });
});

describe('ProfileRepository.updateProfile', () => {
  it('stores the username lowercased and keeps the typed form for display', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      name: 'Caffeinated Duck',
      username: 'duck.lover',
      bio: 'Mostly bread.',
      defaultMood: 'happy',
    } as PrismaUser);

    await expect(repository.updateProfile('u1', update)).resolves.toEqual({
      id: 'u1',
      name: 'Caffeinated Duck',
      username: 'duck.lover',
      bio: 'Mostly bread.',
      defaultMood: 'happy',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        name: 'Caffeinated Duck',
        username: 'duck.lover',
        displayUsername: 'Duck.Lover',
        bio: 'Mostly bread.',
        defaultMood: 'happy',
      },
    });
  });

  it('turns a unique-constraint clash into UsernameTakenError', async () => {
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(repository.updateProfile('u1', update)).rejects.toBeInstanceOf(
      UsernameTakenError,
    );
  });
});
