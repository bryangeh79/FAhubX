import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskExecutorService } from './task-executor.service';
import { BrowserAutomationService } from './integrations/browser-automation.service';
import { DialogueScriptService } from './integrations/dialogue-script.service';
import { FacebookChatService } from './integrations/facebook-chat.service';
import { FacebookPostService } from './integrations/facebook-post.service';
import { AccountWarmingService } from './integrations/account-warming.service';
import { FacebookSocialService } from './integrations/facebook-social.service';
import { Task } from '../task-scheduler/entities/task.entity';
import { TaskExecutionLog } from '../task-scheduler/entities/task-execution-log.entity';
import { FacebookAccountsModule } from '../facebook-accounts/facebook-accounts.module';
import { ChatScriptsModule } from '../chat-scripts/chat-scripts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskExecutionLog]),
    FacebookAccountsModule,
    ChatScriptsModule,
  ],
  providers: [
    TaskExecutorService,
    BrowserAutomationService,
    DialogueScriptService,
    FacebookChatService,
    FacebookPostService,
    AccountWarmingService,
    FacebookSocialService,
  ],
  exports: [
    TaskExecutorService,
    BrowserAutomationService,
    DialogueScriptService,
    FacebookChatService,
    FacebookPostService,
    AccountWarmingService,
    FacebookSocialService,
  ],
})
export class TaskExecutorModule {}
