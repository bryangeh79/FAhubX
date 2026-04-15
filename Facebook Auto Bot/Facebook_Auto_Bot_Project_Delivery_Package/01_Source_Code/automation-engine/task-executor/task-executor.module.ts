import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskExecutorService } from './task-executor.service';
import { BrowserAutomationService } from './integrations/browser-automation.service';
import { DialogueScriptService } from './integrations/dialogue-script.service';
import { Task } from '../task-scheduler/entities/task.entity';
import { TaskExecutionLog } from '../task-scheduler/entities/task-execution-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskExecutionLog]),
  ],
  providers: [
    TaskExecutorService,
    BrowserAutomationService,
    DialogueScriptService,
  ],
  exports: [
    TaskExecutorService,
    BrowserAutomationService,
    DialogueScriptService,
  ],
})
export class TaskExecutorModule {}