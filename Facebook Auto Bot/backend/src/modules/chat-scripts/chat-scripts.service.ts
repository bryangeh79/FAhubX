import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatScript } from './entities/chat-script.entity';
import { UpdateChatScriptDto } from './dto/update-chat-script.dto';

const CATEGORIES = ['推广', '问候', '活动', '售后', '邀请'];

@Injectable()
export class ChatScriptsService {
  constructor(
    @InjectRepository(ChatScript)
    private readonly repo: Repository<ChatScript>,
  ) {}

  /**
   * Get all 50 scripts for user, auto-seeding if missing.
   */
  async findAllByUser(userId: string): Promise<ChatScript[]> {
    const existing = await this.repo.find({
      where: { userId },
      order: { scriptNumber: 'ASC' },
    });

    if (existing.length < 50) {
      await this.seedScripts(userId, existing.map(s => s.scriptNumber));
      return this.repo.find({ where: { userId }, order: { scriptNumber: 'ASC' } });
    }

    return existing;
  }

  async findOne(userId: string, id: string): Promise<ChatScript> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async findByNumber(userId: string, scriptNumber: number): Promise<ChatScript> {
    // Ensure seeded
    await this.findAllByUser(userId);
    return this.repo.findOne({ where: { userId, scriptNumber } });
  }

  async update(userId: string, id: string, dto: UpdateChatScriptDto): Promise<ChatScript> {
    // 用 save() 代替 update()，避免 TypeORM 对 JSONB 数组字段处理不当
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) return null;
    Object.assign(existing, dto, { updatedAt: new Date() });
    return this.repo.save(existing);
  }

  private async seedScripts(userId: string, existingNumbers: number[]): Promise<void> {
    const toCreate: Partial<ChatScript>[] = [];
    for (let i = 1; i <= 50; i++) {
      if (existingNumbers.includes(i)) continue;
      toCreate.push({
        userId,
        scriptNumber: i,
        title: `聊天模式${i}`,
        goal: '',
        systemPrompt: `你是一个专业的Facebook营销助手。你的任务是代表账号A与用户B进行自然对话，达成推广目标。请保持对话自然、友善，不要透露自己是AI。每次回复不超过2句话。`,
        phases: [
          { label: '第一阶段：开场问候', messages: ['你好！最近有空吗，想和你分享一个好消息 😊'] },
          { label: '第二阶段：引出话题', messages: ['我们最近有一个活动，你可能会感兴趣...'] },
          { label: '第三阶段：跟进', messages: ['如果有任何问题随时问我！'] },
        ],
        category: CATEGORIES[(i - 1) % 5],
      });
    }

    if (toCreate.length > 0) {
      await this.repo.save(toCreate as ChatScript[]);
    }
  }
}
