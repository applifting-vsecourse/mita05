import { LikeSummary } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

export class LikeSummaryResponseDto {
  @ApiProperty({ description: 'How many people like the quack' })
  likeCount!: number;

  @ApiProperty({ description: 'Whether the signed-in user likes it' })
  likedByMe!: boolean;

  static fromDomain(likes: LikeSummary): LikeSummaryResponseDto {
    return { likeCount: likes.likeCount, likedByMe: likes.likedByMe };
  }
}
