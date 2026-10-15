export type PollOption = {
  id: string;
  text: string;
  voteCount: number;
};

/** A poll as one viewer sees it: counts for everyone, plus that viewer's own pick. */
export type Poll = {
  id: string;
  /** In the order the author typed them. */
  options: PollOption[];
  totalVotes: number;
  /** The viewer's own answer, or null if they haven't voted. Never anyone else's. */
  myVoteOptionId: string | null;
};
