import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateQuackDto } from './create-quack.dto';

const valid = { text: 'Where do we go for lunch?' };

const withAnswers = (options: unknown): object => ({
  ...valid,
  poll: { options },
});

// Nested errors sit under `poll` → `options`; flatten them to messages.
const errorMessages = async (body: object): Promise<string[]> => {
  const flatten = (errors: ValidationError[]): string[] =>
    errors.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...flatten(error.children ?? []),
    ]);
  return flatten(await validate(plainToInstance(CreateQuackDto, body)));
};

describe('CreateQuackDto poll', () => {
  it('accepts a quack without a poll, as before', async () => {
    await expect(errorMessages(valid)).resolves.toEqual([]);
    await expect(errorMessages({ ...valid, mood: 'happy' })).resolves.toEqual(
      [],
    );
  });

  it('accepts 2 and 4 answers', async () => {
    await expect(
      errorMessages(withAnswers(['Pizza', 'Thai'])),
    ).resolves.toEqual([]);
    await expect(
      errorMessages(withAnswers(['Pizza', 'Thai', 'Salad bar', 'Sushi'])),
    ).resolves.toEqual([]);
  });

  it('rejects 1 answer', async () => {
    await expect(errorMessages(withAnswers(['Pizza']))).resolves.toEqual([
      'A poll needs at least 2 answers',
    ]);
  });

  it('rejects 5 answers', async () => {
    await expect(
      errorMessages(withAnswers(['Pizza', 'Thai', 'Salad', 'Sushi', 'Tacos'])),
    ).resolves.toEqual(['A poll can have at most 4 answers']);
  });

  it.each(['', '   '])('rejects the empty answer %p', async (empty) => {
    await expect(
      errorMessages(withAnswers(['Pizza', empty])),
    ).resolves.toContain('Answers cannot be empty');
  });

  it('accepts an 80-character answer and rejects an 81-character one', async () => {
    await expect(
      errorMessages(withAnswers(['Pizza', 'a'.repeat(80)])),
    ).resolves.toEqual([]);
    await expect(
      errorMessages(withAnswers(['Pizza', 'a'.repeat(81)])),
    ).resolves.toEqual(['Answers can be at most 80 characters']);
  });

  it('counts length after trimming', async () => {
    await expect(
      errorMessages(withAnswers(['Pizza', `  ${'a'.repeat(80)}  `])),
    ).resolves.toEqual([]);
  });

  it('rejects answers that differ only in case or surrounding spaces', async () => {
    await expect(
      errorMessages(withAnswers(['Pizza', ' pizza ', 'Thai'])),
    ).resolves.toEqual(['Answers must all be different']);
  });

  it('trims the answers it keeps', async () => {
    const dto = plainToInstance(
      CreateQuackDto,
      withAnswers([' Pizza ', 'Thai  ']),
    );

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.poll?.options).toEqual(['Pizza', 'Thai']);
  });

  it.each([
    ['a poll without answers', { ...valid, poll: {} }],
    ['answers that are not a list', withAnswers('Pizza, Thai')],
    ['answers that are not text', withAnswers(['Pizza', 42])],
    ['a poll that is not an object', { ...valid, poll: 'yes' }],
  ])('rejects %s', async (_, body) => {
    await expect(errorMessages(body)).resolves.not.toEqual([]);
  });
});
