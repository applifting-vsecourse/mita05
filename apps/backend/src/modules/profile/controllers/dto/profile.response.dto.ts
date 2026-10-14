import { Profile } from '@/modules/profile/domain/profile';
import { QUACK_MOODS, type QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  defaultMood!: QuackMood | null;

  static fromDomain(profile: Profile): ProfileResponseDto {
    return {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      defaultMood: profile.defaultMood,
    };
  }
}
