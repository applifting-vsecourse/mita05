import {
  OptionNotInPollError,
  PollNotFoundError,
} from '@/modules/poll/domain/poll';
import { PollsService } from '@/modules/poll/services/polls.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PollResponseDto } from './dto/poll.response.dto';
import { VoteDto } from './dto/vote.dto';

@ApiTags('polls')
@Controller('polls')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  // PUT because it sets "my vote in this poll": repeating it changes nothing.
  // There is deliberately no DELETE — a vote can be moved, not removed.
  @Put(':pollId/vote')
  @ApiOperation({
    summary: 'Vote in a poll, or move your vote to another answer',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 400, description: 'Answer is not part of this poll' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  async vote(
    @User() user: Identity,
    @Param('pollId') pollId: string,
    @Body() body: VoteDto,
  ): Promise<PollResponseDto> {
    try {
      const poll = await this.pollsService.vote(user, pollId, body.optionId);
      return PollResponseDto.fromDomain(poll);
    } catch (error) {
      if (error instanceof PollNotFoundError) {
        throw new NotFoundException('Poll not found');
      }
      if (error instanceof OptionNotInPollError) {
        throw new BadRequestException('That answer is not part of this poll');
      }
      throw error;
    }
  }
}
