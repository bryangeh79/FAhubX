import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FacebookAccountsService } from './facebook-accounts.service';
import { FacebookAccountsController } from './facebook-accounts.controller';
import { FacebookAccount } from './entities/facebook-account.entity';
import { FacebookLoginService } from './facebook-login.service';
import { BrowserSessionService } from './browser-session.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FacebookAccount]),
    AuthModule,
  ],
  controllers: [FacebookAccountsController],
  providers: [
    FacebookAccountsService,
    FacebookLoginService,
    BrowserSessionService,
  ],
  exports: [FacebookAccountsService, FacebookLoginService, BrowserSessionService],
})
export class FacebookAccountsModule {}
