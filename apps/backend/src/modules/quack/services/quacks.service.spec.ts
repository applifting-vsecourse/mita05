// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

const viewer = { id: 'viewer' } as Identity;

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks(viewer)).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
    // the viewer decides whose vote is reported as "my vote" in each poll
    expect(repository.getQuacks).toHaveBeenCalledWith('viewer', []);
  });

  it('splits a search into words that must all match', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository);

    await service.getQuacks(viewer, '  lunch   adela ');

    expect(repository.getQuacks).toHaveBeenCalledWith('viewer', [
      'lunch',
      'adela',
    ]);
  });

  it('ignores a leading @ so @handle finds the username', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository);

    await service.getQuacks(viewer, '@ada lunch@noon');

    expect(repository.getQuacks).toHaveBeenCalledWith('viewer', [
      'ada',
      'lunch@noon',
    ]);
  });

  it('treats a blank search as no search', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository);

    await service.getQuacks(viewer, '   ');
    await service.getQuacks(viewer, '@');

    expect(repository.getQuacks).toHaveBeenNthCalledWith(1, 'viewer', []);
    expect(repository.getQuacks).toHaveBeenNthCalledWith(2, 'viewer', []);
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
      userId: 'u1',
      pollOptions: null,
    });
  });

  it('passes the chosen mood through to the repository', async () => {
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(aQuack({ mood: 'silly' }));

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await service.createQuack(user, { text: 'hello', mood: 'silly' });

    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: 'silly',
      userId: 'u1',
      pollOptions: null,
    });
  });

  it('passes poll answers through to the repository in order', async () => {
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(aQuack());

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await service.createQuack(user, {
      text: 'Where do we go for lunch?',
      poll: { options: ['Pizza', 'Thai', 'Salad bar'] },
    });

    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'Where do we go for lunch?',
      mood: null,
      userId: 'u1',
      pollOptions: ['Pizza', 'Thai', 'Salad bar'],
    });
  });
});
