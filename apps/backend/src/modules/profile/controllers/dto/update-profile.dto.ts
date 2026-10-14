import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/modules/profile/domain/profile';
import { QUACK_MOODS, type QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiProperty({
    description:
      'Letters, numbers, dots and underscores. Stored lowercased, like at sign-up.',
    example: 'caffeinated.duck',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, {
    message: `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters`,
  })
  @Matches(USERNAME_PATTERN, {
    message: 'Username can only contain letters, numbers, dots and underscores',
  })
  username!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'Caffeinated Duck',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Display name is required' })
  @MaxLength(NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({
    description: 'Short bio; null or empty for none',
    example: 'Mostly bread.',
    maxLength: BIO_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  bio!: string | null;

  @ApiProperty({
    description: 'Mood preselected for new quacks; null for none',
    enum: QUACK_MOODS,
    nullable: true,
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  defaultMood!: QuackMood | null;
}
