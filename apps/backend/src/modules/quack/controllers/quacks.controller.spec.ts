import {
  QuackNotFoundError,
  QuackNotOwnedError,
} from '@/modules/quack/domain/quack';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { Identity } from '@/shared/auth/domain/identity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { QuacksController } from './quacks.controller';

// The real guard imports BetterAuth and its email templates, which Jest can't
// load. Sign-in is not what this spec tests; the controller's error mapping is.
jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const user = { id: 'u1', role: 'user' } as Identity;

describe('QuacksController.list', () => {
  it("lists only the user's quacks for author=me", async () => {
    const service = mock<QuacksService>();
    service.getQuacks.mockResolvedValue([]);

    await new QuacksController(service).list(user, {
      q: 'lunch',
      author: 'me',
    });

    expect(service.getQuacks).toHaveBeenCalledWith(user, 'lunch', true);
  });

  it('lists everyone’s quacks without an author', async () => {
    const service = mock<QuacksService>();
    service.getQuacks.mockResolvedValue([]);

    await new QuacksController(service).list(user, {});

    expect(service.getQuacks).toHaveBeenCalledWith(user, undefined, false);
  });
});

describe('QuacksController.delete', () => {
  it('deletes the quack as the signed-in user', async () => {
    const service = mock<QuacksService>();
    service.deleteQuack.mockResolvedValue();

    await expect(
      new QuacksController(service).delete(user, 'q1'),
    ).resolves.toBeUndefined();
    expect(service.deleteQuack).toHaveBeenCalledWith(user, 'q1');
  });

  it('answers 404 for an unknown quack', async () => {
    const service = mock<QuacksService>();
    service.deleteQuack.mockRejectedValue(new QuackNotFoundError('nope'));

    await expect(
      new QuacksController(service).delete(user, 'nope'),
    ).rejects.toThrow(NotFoundException);
  });

  it("lets an admin delete someone else's quack", async () => {
    const admin = { id: 'mod', role: 'admin' } as Identity;
    const service = mock<QuacksService>();
    service.deleteQuack.mockResolvedValue();

    await expect(
      new QuacksController(service).delete(admin, 'q1'),
    ).resolves.toBeUndefined();
    expect(service.deleteQuack).toHaveBeenCalledWith(admin, 'q1');
  });

  it("answers 403 for someone else's quack", async () => {
    const service = mock<QuacksService>();
    service.deleteQuack.mockRejectedValue(new QuackNotOwnedError('q1'));

    await expect(
      new QuacksController(service).delete(user, 'q1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
