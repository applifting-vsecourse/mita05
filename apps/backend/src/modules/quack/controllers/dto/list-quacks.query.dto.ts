import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListQuacksQueryDto {
  @ApiPropertyOptional({
    description:
      'Only quacks where every word appears in the text, author name or @username (case-insensitive)',
    example: 'lunch adela',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  // A search longer than the longest possible quack can't match its text anyway.
  @MaxLength(280)
  q?: string;
}
