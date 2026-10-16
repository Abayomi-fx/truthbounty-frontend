import {
  Controller,
  Post,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { IdentityService } from '../services/identity.service';

@Controller('identity/users')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  /**
   * 🔐 Verify Worldcoin identity
   * Only the account owner can verify themselves
   */
  @Post(':id/verify-worldcoin')
  @UseGuards(AuthGuard)
  async verifyWorldcoin(
    @Param('id') userId: string,
    @Req() req: Request & { user?: any },
  ) {
    const authUser = req.user;

    // ✅ Ownership enforcement (CRITICAL)
    if (!authUser || authUser.id !== userId) {
      throw new ForbiddenException(
        'You can only verify your own identity',
      );
    }

    return this.identityService.verifyWorldcoin(userId);
  }
}