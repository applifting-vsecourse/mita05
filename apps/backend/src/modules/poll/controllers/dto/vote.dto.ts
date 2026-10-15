import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoteDto {
  @ApiProperty({ description: 'One of the poll’s answer ids' })
  @IsString()
  @IsNotEmpty()
  optionId!: string;
}
