import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * SubscriptionGuard — 订阅过期校验
 *
 * 用于写操作端点（创建账号、执行任务等）。
 * 到期后用户仍可登录查看数据，但不能执行任何写操作。
 *
 * 规则：
 *  - admin 角色：跳过
 *  - subscriptionExpiry 为 null：永久有效，跳过
 *  - subscriptionExpiry < 当前时间：抛出 403
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub || request.user?.id;

    if (!userId) return true; // 未认证走 JwtAuthGuard 处理

    // 从 JWT payload 快速判断 admin
    if (request.user?.role === 'admin') return true;

    // 查询数据库获取最新的订阅状态
    const [user] = await this.dataSource.query(
      `SELECT "subscriptionExpiry", role, status FROM users WHERE id = $1`,
      [userId],
    );

    if (!user) return true; // 用户不存在走其他 guard 处理

    // admin 角色跳过
    if (user.role === 'admin') return true;

    // null = 永久有效
    if (!user.subscriptionExpiry) return true;

    // 检查是否过期
    if (new Date(user.subscriptionExpiry) < new Date()) {
      throw new ForbiddenException('订阅已过期，请联系管理员续期。您仍可查看现有数据，但无法执行操作。');
    }

    return true;
  }
}
