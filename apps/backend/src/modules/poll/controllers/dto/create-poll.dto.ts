import {
  normalisePollOption,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
} from '@/modules/poll/domain/poll';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class CreatePollDto {
  @ApiProperty({
    description: `${POLL_MIN_OPTIONS}–${POLL_MAX_OPTIONS} answers in display order. Trimmed; must differ ignoring case.`,
    example: ['Pizza', 'Thai', 'Salad bar'],
    type: [String],
    minItems: POLL_MIN_OPTIONS,
    maxItems: POLL_MAX_OPTIONS,
  })
  @Transform(trimEach)
  @IsArray()
  @ArrayMinSize(POLL_MIN_OPTIONS, {
    message: `A poll needs at least ${POLL_MIN_OPTIONS} answers`,
  })
  @ArrayMaxSize(POLL_MAX_OPTIONS, {
    message: `A poll can have at most ${POLL_MAX_OPTIONS} answers`,
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Answers cannot be empty' })
  @MaxLength(POLL_OPTION_MAX_LENGTH, {
    each: true,
    message: `Answers can be at most ${POLL_OPTION_MAX_LENGTH} characters`,
  })
  @ArrayUnique(
    (option: unknown) =>
      typeof option === 'string' ? normalisePollOption(option) : option,
    { message: 'Answers must all be different' },
  )
  options!: string[];
}
