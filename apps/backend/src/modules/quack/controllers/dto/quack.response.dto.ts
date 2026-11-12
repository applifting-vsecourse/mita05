import { PollResponseDto } from '@/modules/poll/controllers/dto/poll.response.dto';
import {
  Quack,
  QUACK_MOODS,
  QuackReply,
  type QuackMood,
} from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

export class ReplyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: 'The quack this reply answers' })
  parentId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto })
  user!: QuackUserDto;

  static fromDomain(reply: QuackReply): ReplyResponseDto {
    if (!reply.user) {
      throw new Error(
        `ReplyResponseDto.fromDomain expected reply.user to be loaded for reply ${reply.id}`,
      );
    }
    return {
      id: reply.id,
      text: reply.text,
      userId: reply.userId,
      parentId: reply.parentId,
      createdAt: reply.createdAt,
      user: {
        id: reply.user.id,
        name: reply.user.name,
        username: reply.user.username,
      },
    };
  }
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when the quack was deleted (isDeleted)',
  })
  text!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  mood!: QuackMood | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when the quack was deleted (isDeleted)',
  })
  userId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({
    description:
      'A deleted quack kept as a placeholder for its replies. Its text, mood, poll and author are never returned.',
  })
  isDeleted!: boolean;

  @ApiProperty({
    type: QuackUserDto,
    nullable: true,
    description: 'Null when the quack was deleted (isDeleted)',
  })
  user!: QuackUserDto | null;

  @ApiProperty({
    type: PollResponseDto,
    nullable: true,
    description: 'Null when the quack has no poll',
  })
  poll!: PollResponseDto | null;

  @ApiProperty({ type: [ReplyResponseDto], description: 'Oldest first' })
  replies!: ReplyResponseDto[];

  static fromDomain(quack: Quack): QuackResponseDto {
    const replies = (quack.replies ?? []).map(ReplyResponseDto.fromDomain);
    if (quack.isDeleted) {
      // The one place a tombstone leaves the server: nothing of the deleted
      // quack or its author, only its place in the feed and its replies.
      return {
        id: quack.id,
        text: null,
        mood: null,
        userId: null,
        createdAt: quack.createdAt,
        isDeleted: true,
        user: null,
        poll: null,
        replies,
      };
    }
    if (!quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    if (quack.poll === undefined) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.poll to be loaded for quack ${quack.id}`,
      );
    }
    return {
      id: quack.id,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      createdAt: quack.createdAt,
      isDeleted: false,
      user: {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username,
      },
      poll: quack.poll ? PollResponseDto.fromDomain(quack.poll) : null,
      replies,
    };
  }
}
