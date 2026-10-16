import {
  Controller,
  Post,
  UseGuards,
  Body,
} from '@nestjs/common';
import { SybilScoreService } from '../services/sybil-score.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('admin/sybil')
@UseGuards(AuthGuard, RolesGuard)
export class SybilAdminController {
  constructor(private readonly sybilService: SybilScoreService) {}

  /**
   * 🔐 Admin-only batch recalculation
   */
  @Post('recalculate')
  @Roles('admin', 'superadmin')
  async recalculate(@Body() body: {
    batchSize?: number;
    concurrency?: number;
    checkpointUserId?: string;
  }) {
    return this.sybilService.recalculateAllScores(body);
  }
}