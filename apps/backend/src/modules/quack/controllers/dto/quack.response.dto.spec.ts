import { Quack } from '@/modules/quack/domain/quack';
import { QuackResponseDto } from './quack.response.dto';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'Where do we go for lunch?',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: null,
  ...overrides,
});

describe('QuackResponseDto.fromDomain', () => {
  it('includes the poll with counts and the viewer’s pick', () => {
    const poll = {
      id: 'p1',
      options: [
        { id: 'o1', text: 'Pizza', voteCount: 3 },
        { id: 'o2', text: 'Thai', voteCount: 1 },
      ],
      totalVotes: 4,
      myVoteOptionId: 'o1',
    };

    expect(QuackResponseDto.fromDomain(aQuack({ poll })).poll).toEqual(poll);
  });

  it('returns null for a quack without a poll', () => {
    expect(QuackResponseDto.fromDomain(aQuack()).poll).toBeNull();
  });

  it('refuses a quack whose poll was not loaded', () => {
    expect(() =>
      QuackResponseDto.fromDomain(aQuack({ poll: undefined })),
    ).toThrow('quack.poll to be loaded');
  });
});
