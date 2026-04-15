import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 创建新用户
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // 验证密码匹配
    if (createUserDto.password !== createUserDto.confirmPassword) {
      throw new BadRequestException('密码和确认密码不匹配');
    }

    // 检查邮箱是否已存在
    const existingEmail = await this.usersRepository.findOne({
      where: { email: createUserDto.email.toLowerCase() },
      withDeleted: true,
    });

    if (existingEmail) {
      if (existingEmail.deletedAt) {
        throw new ConflictException('该邮箱地址已被删除，请联系管理员恢复');
      }
      throw new ConflictException('该邮箱地址已被注册');
    }

    // 检查用户名是否已存在
    const existingUsername = await this.usersRepository.findOne({
      where: { username: createUserDto.username.toLowerCase() },
      withDeleted: true,
    });

    if (existingUsername) {
      if (existingUsername.deletedAt) {
        throw new ConflictException('该用户名已被删除，请联系管理员恢复');
      }
      throw new ConflictException('该用户名已被使用');
    }

    try {
      // 哈希密码
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

      // 创建用户实体
      const user = this.usersRepository.create({
        email: createUserDto.email,
        username: createUserDto.username,
        passwordHash,
        fullName: createUserDto.fullName,
        timezone: createUserDto.timezone || 'UTC',
        language: createUserDto.language || 'en',
        preferences: createUserDto.preferences || {},
      });

      // 保存用户
      const savedUser = await this.usersRepository.save(user);

      // 转换为响应DTO
      return this.toResponseDto(savedUser);
    } catch (error) {
      if (error.code === '23505') {
        // PostgreSQL唯一约束冲突
        throw new ConflictException('用户创建失败，请检查邮箱和用户名是否唯一');
      }
      throw new InternalServerErrorException('用户创建失败，请稍后重试');
    }
  }

  /**
   * 查找所有用户
   */
  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      status?: string;
      emailVerified?: boolean;
      search?: string;
    },
  ): Promise<{
    users: UserResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // 应用过滤器
    if (filters?.status) {
      queryBuilder.andWhere('user.status = :status', { status: filters.status });
    }

    if (filters?.emailVerified !== undefined) {
      queryBuilder.andWhere('user.emailVerified = :emailVerified', {
        emailVerified: filters.emailVerified,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.username ILIKE :search OR user.fullName ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // 排除已删除的用户
    queryBuilder.andWhere('user.deletedAt IS NULL');

    // 获取总数
    const total = await queryBuilder.getCount();

    // 获取分页数据
    const users = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return {
      users: users.map(user => this.toResponseDto(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 根据ID查找用户
   */
  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    return this.toResponseDto(user);
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { username: username.toLowerCase() },
    });
  }

  /**
   * 更新用户信息
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    // 检查邮箱是否已被其他用户使用
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.usersRepository.findOne({
        where: { email: updateUserDto.email.toLowerCase() },
      });

      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException('该邮箱地址已被其他用户使用');
      }
    }

    // 检查用户名是否已被其他用户使用
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.usersRepository.findOne({
        where: { username: updateUserDto.username.toLowerCase() },
      });

      if (existingUsername && existingUsername.id !== id) {
        throw new ConflictException('该用户名已被其他用户使用');
      }
    }

    // 更新用户信息
    Object.assign(user, updateUserDto);

    try {
      const updatedUser = await this.usersRepository.save(user);
      return this.toResponseDto(updatedUser);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('更新失败，请检查邮箱和用户名是否唯一');
      }
      throw new InternalServerErrorException('更新失败，请稍后重试');
    }
  }

  /**
   * 更新用户偏好设置
   */
  async updatePreferences(id: string, preferencesDto: UpdatePreferencesDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    // 合并偏好设置
    user.preferences = {
      ...user.preferences,
      ...preferencesDto.preferences,
    };

    const updatedUser = await this.usersRepository.save(user);
    return this.toResponseDto(updatedUser);
  }

  /**
   * 删除用户（软删除）
   */
  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    // 软删除
    await this.usersRepository.softDelete(id);
  }

  /**
   * 验证用户密码
   */
  async validatePassword(user: User | { id: string; passwordHash?: string }, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      // fetch the full user entity if passwordHash is not available
      const fullUser = await this.usersRepository.findOne({ where: { id: user.id } });
      if (!fullUser) return false;
      return bcrypt.compare(password, fullUser.passwordHash);
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * 更新用户密码
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.usersRepository.save(user);
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    if (user.emailVerified) {
      return this.toResponseDto(user);
    }

    user.emailVerified = true;
    const updatedUser = await this.usersRepository.save(user);

    return this.toResponseDto(updatedUser);
  }

  /**
   * 更新登录统计
   */
  async updateLoginStats(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      return;
    }

    user.incrementLoginCount();
    await this.usersRepository.save(user);
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      language: user.language,
      preferences: user.preferences,
      totalLogins: user.totalLogins,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 获取用户统计信息
   */
  async getStats(userId: string): Promise<{
    totalAccounts: number;
    totalTasks: number;
    activeTasks: number;
    successRate: number;
    lastActivity: Date;
  }> {
    // 这里需要连接其他表获取统计信息
    // 暂时返回模拟数据
    return {
      totalAccounts: 0,
      totalTasks: 0,
      activeTasks: 0,
      successRate: 0,
      lastActivity: new Date(),
    };
  }
}