import { Quack } from '@/modules/quack/domain/quack';
import { QuackResponseDto } from './quack.response.dto';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'Where do we go for lunch?',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  isDeleted: false,
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

  it('returns nothing of a tombstone but its place and its replies', () => {
    const reply = {
      id: 'r1',
      text: 'Deleting it won’t save you.',
      userId: 'u2',
      parentId: 'q1',
      createdAt: new Date('2026-01-01T12:05:00Z'),
      user: { id: 'u2', name: 'Bread Critic', username: 'BreadCritic' },
    };
    // Even if the domain object still carried content, the DTO drops it.
    const dto = QuackResponseDto.fromDomain(
      aQuack({
        isDeleted: true,
        text: 'secret',
        mood: 'angry',
        replies: [reply],
      }),
    );

    expect(dto).toEqual({
      id: 'q1',
      text: null,
      mood: null,
      userId: null,
      createdAt: new Date('2026-01-01T12:00:00Z'),
      isDeleted: true,
      user: null,
      poll: null,
      replies: [reply],
    });
    expect(JSON.stringify(dto)).not.toContain('secret');
    expect(JSON.stringify(dto)).not.toContain('CaffeinatedDuck');
  });

  it('includes replies of a live quack', () => {
    const reply = {
      id: 'r1',
      text: 'Pizza',
      userId: 'u2',
      parentId: 'q1',
      createdAt: new Date('2026-01-01T12:05:00Z'),
      user: { id: 'u2', name: 'Bread Critic', username: 'BreadCritic' },
    };

    const dto = QuackResponseDto.fromDomain(aQuack({ replies: [reply] }));

    expect(dto.isDeleted).toBe(false);
    expect(dto.replies).toEqual([reply]);
  });
});
