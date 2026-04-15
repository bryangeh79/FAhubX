import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FacebookAccountsService } from './facebook-accounts.service';
import { FacebookAccountsController } from './facebook-accounts.controller';
import { FacebookAccount } from './entities/facebook-account.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FacebookAccount]),
    AuthModule,
  ],
  controllers: [FacebookAccountsController],
  providers: [FacebookAccountsService],
  exports: [FacebookAccountsService],
})
export class FacebookAccountsModule {}