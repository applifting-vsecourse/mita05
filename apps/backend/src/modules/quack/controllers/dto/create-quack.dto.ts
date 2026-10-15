import { CreatePollDto } from '@/modules/poll/controllers/dto/create-poll.dto';
import { QUACK_MOODS, type QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional({
    description: 'How the author feels about the quack',
    enum: QUACK_MOODS,
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  mood?: QuackMood;

  @ApiPropertyOptional({
    description: 'Attach a poll; the quack text is its question',
    type: CreatePollDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;
}
