import { ValidationPipe } from '@nestjs/common';
import { CreateReplyDto } from './create-reply.dto';

// The same options as QuacksController, so a reply with a mood or poll is refused.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validate = (body: unknown): Promise<unknown> =>
  pipe.transform(body, { type: 'body', metatype: CreateReplyDto });

describe('CreateReplyDto', () => {
  it('accepts text', async () => {
    await expect(validate({ text: 'Count me in' })).resolves.toEqual({
      text: 'Count me in',
    });
  });

  it.each([
    ['an empty text', { text: '' }],
    ['text over 280 characters', { text: 'q'.repeat(281) }],
    ['a mood', { text: 'hi', mood: 'happy' }],
    ['a poll', { text: 'hi', poll: { options: ['a', 'b'] } }],
  ])('refuses %s', async (_label, body) => {
    await expect(validate(body)).rejects.toThrow();
  });
});
