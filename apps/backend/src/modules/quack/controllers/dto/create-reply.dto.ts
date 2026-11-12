import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Text only: with forbidNonWhitelisted on the controller, a reply that sends
// `mood` or `poll` is refused with 400.
export class CreateReplyDto {
  @ApiProperty({
    description: 'Body of the reply',
    example: 'Count me in!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;
}
