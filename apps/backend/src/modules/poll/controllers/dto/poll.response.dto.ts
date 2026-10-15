import { Poll } from '@/modules/poll/domain/poll';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  voteCount!: number;
}

export class PollResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: [PollOptionResponseDto],
    description: 'In the order the author typed them',
  })
  options!: PollOptionResponseDto[];

  @ApiProperty()
  totalVotes!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "The signed-in user's answer, or null if they haven't voted",
  })
  myVoteOptionId!: string | null;

  static fromDomain(poll: Poll): PollResponseDto {
    return {
      id: poll.id,
      options: poll.options.map(({ id, text, voteCount }) => ({
        id,
        text,
        voteCount,
      })),
      totalVotes: poll.totalVotes,
      myVoteOptionId: poll.myVoteOptionId,
    };
  }
}
