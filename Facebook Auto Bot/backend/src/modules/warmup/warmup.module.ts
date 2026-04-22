import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarmupService } from './warmup.service';
import { WarmupController } from './warmup.controller';
import { WarmupProgress } from './entities/warmup-progress.entity';
import { FacebookAccount } from '../facebook-accounts/entities/facebook-account.entity';
import { Task } from '../task-scheduler/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WarmupProgress, FacebookAccount, Task]),
  ],
  providers: [WarmupService],
  controllers: [WarmupController],
  exports: [WarmupService],
})
export class WarmupModule {}
