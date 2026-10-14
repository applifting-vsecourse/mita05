import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

const valid = {
  username: 'duck.lover_1',
  name: 'Caffeinated Duck',
  bio: null,
  defaultMood: null,
};

const invalidFields = async (body: object): Promise<string[]> =>
  (await validate(plainToInstance(UpdateProfileDto, body))).map(
    (error) => error.property,
  );

describe('UpdateProfileDto', () => {
  it('accepts a valid profile', async () => {
    await expect(invalidFields(valid)).resolves.toEqual([]);
    await expect(
      invalidFields({ ...valid, bio: 'Mostly bread.', defaultMood: 'silly' }),
    ).resolves.toEqual([]);
  });

  it.each(['ab', 'a'.repeat(31), 'duck lover', 'duck-lover', 'duck%', 'dück'])(
    'rejects the username %p',
    async (username) => {
      await expect(invalidFields({ ...valid, username })).resolves.toEqual([
        'username',
      ]);
    },
  );

  it('accepts usernames of exactly 3 and 30 characters', async () => {
    await expect(invalidFields({ ...valid, username: 'abc' })).resolves.toEqual(
      [],
    );
    await expect(
      invalidFields({ ...valid, username: 'a'.repeat(30) }),
    ).resolves.toEqual([]);
  });

  it('trims surrounding whitespace before validating', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      ...valid,
      username: '  duck  ',
      name: '  Duck ',
    });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.username).toBe('duck');
    expect(dto.name).toBe('Duck');
  });

  it('requires a display name', async () => {
    await expect(invalidFields({ ...valid, name: '   ' })).resolves.toEqual([
      'name',
    ]);
  });

  it('limits the bio to 160 characters', async () => {
    await expect(
      invalidFields({ ...valid, bio: 'a'.repeat(160) }),
    ).resolves.toEqual([]);
    await expect(
      invalidFields({ ...valid, bio: 'a'.repeat(161) }),
    ).resolves.toEqual(['bio']);
  });

  it('only accepts known moods', async () => {
    await expect(
      invalidFields({ ...valid, defaultMood: 'grumpy' }),
    ).resolves.toEqual(['defaultMood']);
  });
});
