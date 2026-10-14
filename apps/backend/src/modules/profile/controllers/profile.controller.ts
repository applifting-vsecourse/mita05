import { UsernameTakenError } from '@/modules/profile/domain/profile';
import { ProfileService } from '@/modules/profile/services/profile.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  ConflictException,
  Controller,
  Get,
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
import { ProfileResponseDto } from './dto/profile.response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** The signed-in user's own profile — there is no way to address anyone else's. */
@ApiTags('profile')
@Controller('profile')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get your profile' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async get(@User() user: Identity): Promise<ProfileResponseDto> {
    return ProfileResponseDto.fromDomain(
      await this.profileService.getProfile(user),
    );
  }

  @Put()
  @ApiOperation({ summary: 'Update your profile' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid profile' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 409, description: 'Username is already taken' })
  async update(
    @User() user: Identity,
    @Body() body: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    try {
      const profile = await this.profileService.updateProfile(user, {
        name: body.name,
        username: body.username,
        bio: body.bio ?? null,
        defaultMood: body.defaultMood ?? null,
      });
      return ProfileResponseDto.fromDomain(profile);
    } catch (error) {
      if (error instanceof UsernameTakenError) {
        throw new ConflictException('That username is already taken');
      }
      throw error;
    }
  }
}
