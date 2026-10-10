// Checks the query the repository builds — Prisma itself is mocked,
// so this does not need a database.
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

let prisma: DeepMockProxy<PrismaService>;
let repository: QuackRepository;

beforeEach(() => {
  prisma = mockDeep<PrismaService>();
  prisma.quack.findMany.mockResolvedValue([]);
  repository = new QuackRepository(prisma);
});

const findManyWhere = (): Prisma.QuackWhereInput | undefined =>
  prisma.quack.findMany.mock.calls[0][0]?.where;

const matchesAnywhere = (term: string): Prisma.QuackWhereInput => {
  const contains = { contains: term, mode: 'insensitive' as const };
  return {
    OR: [
      { text: contains },
      { user: { name: contains } },
      { user: { username: contains } },
    ],
  };
};

describe('QuackRepository.getQuacks', () => {
  it('applies no filter without search terms', async () => {
    await repository.getQuacks();

    expect(findManyWhere()).toEqual({ AND: [] });
  });

  it('requires every term to match the text, author name or username', async () => {
    await repository.getQuacks(['lunch', 'adela']);

    expect(findManyWhere()).toEqual({
      AND: [matchesAnywhere('lunch'), matchesAnywhere('adela')],
    });
  });

  it('escapes LIKE wildcards so they match literally', async () => {
    await repository.getQuacks(['50%', 'snake_case', 'back\\slash']);

    expect(findManyWhere()).toEqual({
      AND: [
        matchesAnywhere('50\\%'),
        matchesAnywhere('snake\\_case'),
        matchesAnywhere('back\\\\slash'),
      ],
    });
  });
});
