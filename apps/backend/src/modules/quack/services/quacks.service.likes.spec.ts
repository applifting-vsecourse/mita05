// Likes: the service's part of the rules in docs/features/likes/cases.md.
// The repository is mocked. "Only once" and the counting itself are enforced
// by the database (docs/adr/0002-likes.md) and proven by the integration tests
// in likes.int-spec.ts; these tests pin what the service does around them:
// whose like it is, that repeating is not an error, and when it's a 404.
import { LikeSummary, QuackNotFoundError } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock, MockProxy } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const alice = { id: 'alice', role: 'user' } as Identity;
const bob = { id: 'bob', role: 'user' } as Identity;

const likes = (likeCount: number, likedByMe: boolean): LikeSummary => ({
  likeCount,
  likedByMe,
});

let repository: MockProxy<QuackRepository>;
let service: QuacksService;

beforeEach(() => {
  repository = mock<QuackRepository>();
  service = new QuacksService(repository);
});

describe('QuacksService likes: rules', () => {
  it('R1: liking a quack counts it once', async () => {
    repository.like.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, true),
    );
    // the like belongs to the user from the session
    expect(repository.like).toHaveBeenCalledWith('q1', 'alice');
  });

  it('R2: liking again changes nothing and is not an error', async () => {
    repository.like.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, true),
    );
    await expect(service.likeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, true),
    );
    expect(repository.like).toHaveBeenCalledTimes(2);
  });

  it('R3: taking the like back removes it', async () => {
    repository.unlike.mockResolvedValue(likes(0, false));

    await expect(service.unlikeQuack(alice, 'q1')).resolves.toEqual(
      likes(0, false),
    );
    expect(repository.unlike).toHaveBeenCalledWith('q1', 'alice');
  });

  it('R4: taking back a like you never gave changes nothing and is not an error', async () => {
    repository.unlike.mockResolvedValue(likes(0, false));

    await expect(service.unlikeQuack(alice, 'q1')).resolves.toEqual(
      likes(0, false),
    );
  });

  it('R5: you can like your own quack', async () => {
    repository.getQuackAuthorId.mockResolvedValue('alice');
    repository.like.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, true),
    );
    expect(repository.like).toHaveBeenCalledWith('q1', 'alice');
  });

  it('R6: a reply can be liked', async () => {
    repository.getReplyTarget.mockResolvedValue({
      isReply: true,
      isDeleted: false,
    });
    repository.like.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(alice, 'r1')).resolves.toEqual(
      likes(1, true),
    );
    // only the reply is liked, not the quack it answers
    expect(repository.like).toHaveBeenCalledTimes(1);
    expect(repository.like).toHaveBeenCalledWith('r1', 'alice');
  });

  it('R7: each person counts once', async () => {
    repository.like
      .mockResolvedValueOnce(likes(1, true))
      .mockResolvedValueOnce(likes(2, true));

    await service.likeQuack(alice, 'q1');
    await expect(service.likeQuack(bob, 'q1')).resolves.toEqual(likes(2, true));
    expect(repository.like).toHaveBeenNthCalledWith(1, 'q1', 'alice');
    expect(repository.like).toHaveBeenNthCalledWith(2, 'q1', 'bob');
  });

  it("R8: taking back your like leaves other people's likes alone", async () => {
    repository.unlike.mockResolvedValue(likes(1, false));

    await expect(service.unlikeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, false),
    );
    expect(repository.unlike).toHaveBeenCalledTimes(1);
    expect(repository.unlike).toHaveBeenCalledWith('q1', 'alice');
  });

  it('R9: "liked by me" is reported for whoever is asking', async () => {
    repository.like.mockImplementation(async (_quackId, userId) =>
      likes(1, userId === 'alice'),
    );

    await expect(service.likeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, true),
    );
    expect(repository.like).toHaveBeenCalledWith('q1', 'alice');
  });

  // R10–R12: the repository answers null for every id with no live quack:
  // one that never existed, one that was removed, and a tombstone. Which of
  // the three it is gets proven against the database in A6–A8.
  it.each([
    ['R10: a quack that does not exist', 'nope'],
    ['R11: a fully deleted quack', 'deleted'],
    ['R12: a tombstone', 'tombstone'],
  ])("%s can't be liked or unliked", async (_label, quackId) => {
    repository.like.mockResolvedValue(null);
    repository.unlike.mockResolvedValue(null);

    await expect(service.likeQuack(alice, quackId)).rejects.toThrow(
      QuackNotFoundError,
    );
    await expect(service.unlikeQuack(alice, quackId)).rejects.toThrow(
      QuackNotFoundError,
    );
  });
});
