import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import pLimit from 'p-limit';
import { UserEntity } from '../../users/entities/user.entity';

@Injectable()
export class SybilScoreService {
  private readonly logger = new Logger(SybilScoreService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Recalculate all sybil scores in batches with concurrency control
   */
  async recalculateAllScores(options?: {
    batchSize?: number;
    concurrency?: number;
    checkpointUserId?: string;
  }) {
    const batchSize = options?.batchSize ?? 100;
    const concurrency = options?.concurrency ?? 5;

    const limit = pLimit(concurrency);

    let lastId = options?.checkpointUserId ?? null;
    let totalProcessed = 0;

    this.logger.log(
      `Starting sybil score recalculation (batchSize=${batchSize}, concurrency=${concurrency})`,
    );

    while (true) {
      const users = await this.userRepo.find({
        where: lastId ? { id: MoreThan(lastId) } : {},
        order: { id: 'ASC' },
        take: batchSize,
      });

      if (users.length === 0) break;

      this.logger.log(
        `Processing batch starting from ID ${users[0].id} (size=${users.length})`,
      );

      await Promise.all(
        users.map((user) =>
          limit(async () => {
            try {
              const score = await this.calculateScore(user);
              await this.userRepo.update(user.id, { sybilScore: score });
            } catch (err) {
              this.logger.error(
                `Failed for user ${user.id}: ${err.message}`,
              );
            }
          }),
        ),
      );

      totalProcessed += users.length;
      lastId = users[users.length - 1].id;

      this.logger.log(
        `Progress: ${totalProcessed} users processed (lastId=${lastId})`,
      );
    }

    this.logger.log(
      `✅ Completed sybil recalculation. Total processed: ${totalProcessed}`,
    );

    return {
      success: true,
      totalProcessed,
      lastCheckpoint: lastId,
    };
  }

  /**
   * Actual scoring logic (example)
   */
  private async calculateScore(user: UserEntity): Promise<number> {
    let score = 0;

    if (user.isVerified) score += 50;
    if (user.wallets?.length > 1) score -= 10;
    if (user.createdAt) {
      const ageDays =
        (Date.now() - new Date(user.createdAt).getTime()) / 86400000;
      if (ageDays < 7) score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }
}