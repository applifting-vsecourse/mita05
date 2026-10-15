import {
  OptionNotInPollError,
  Poll,
  PollNotFoundError,
} from '@/modules/poll/domain/poll';
import { PollRepository } from '@/modules/poll/repositories/poll.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock, MockProxy } from 'jest-mock-extended';
import { PollsService } from './polls.service';

const voter = { id: 'voter' } as Identity;

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  id: 'p1',
  options: [
    { id: 'o1', text: 'Pizza', voteCount: 1 },
    { id: 'o2', text: 'Thai', voteCount: 0 },
  ],
  totalVotes: 1,
  myVoteOptionId: 'o1',
  ...overrides,
});

let repository: MockProxy<PollRepository>;
let service: PollsService;

beforeEach(() => {
  repository = mock<PollRepository>();
  repository.getOptionIds.mockResolvedValue(['o1', 'o2']);
  repository.getPoll.mockResolvedValue(aPoll());
  service = new PollsService(repository);
});

describe('PollsService.vote', () => {
  it('sets the vote for the signed-in user and returns fresh counts', async () => {
    await expect(service.vote(voter, 'p1', 'o1')).resolves.toEqual(aPoll());

    // the voter comes from the session, never from the request body
    expect(repository.setVote).toHaveBeenCalledWith({
      pollId: 'p1',
      optionId: 'o1',
      userId: 'voter',
    });
    expect(repository.getPoll).toHaveBeenCalledWith('p1', 'voter');
  });

  it('reads the counts only after the vote is stored', async () => {
    await service.vote(voter, 'p1', 'o1');

    expect(repository.setVote.mock.invocationCallOrder[0]).toBeLessThan(
      repository.getPoll.mock.invocationCallOrder[0],
    );
  });

  it('rejects an unknown poll without voting', async () => {
    repository.getOptionIds.mockResolvedValue(null);

    await expect(service.vote(voter, 'nope', 'o1')).rejects.toThrow(
      PollNotFoundError,
    );
    expect(repository.setVote).not.toHaveBeenCalled();
  });

  it('rejects an answer from another poll without voting', async () => {
    await expect(
      service.vote(voter, 'p1', 'other-poll-option'),
    ).rejects.toThrow(OptionNotInPollError);
    expect(repository.setVote).not.toHaveBeenCalled();
  });

  it('passes on the database refusing the answer', async () => {
    repository.setVote.mockRejectedValue(new OptionNotInPollError('o1', 'p1'));

    await expect(service.vote(voter, 'p1', 'o1')).rejects.toThrow(
      OptionNotInPollError,
    );
  });
});
