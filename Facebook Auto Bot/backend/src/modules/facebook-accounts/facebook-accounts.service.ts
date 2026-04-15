import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { FacebookAccount } from './entities/facebook-account.entity';
import { CreateFacebookAccountDto } from './dto/create-facebook-account.dto';
import { UpdateFacebookAccountDto } from './dto/update-facebook-account.dto';
import { FacebookAccountResponseDto } from './dto/facebook-account-response.dto';

@Injectable()
export class FacebookAccountsService {
  constructor(
    @InjectRepository(FacebookAccount)
    private readonly facebookAccountsRepository: Repository<FacebookAccount>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 创建Facebook账号
   */
  async create(
    userId: string,
    createFacebookAccountDto: CreateFacebookAccountDto,
  ): Promise<FacebookAccountResponseDto> {
    // 检查该用户邮箱是否已添加过
    const existingAccount = await this.facebookAccountsRepository.findOne({
      where: { email: createFacebookAccountDto.email, userId },
      withDeleted: true,
    });

    if (existingAccount) {
      if (existingAccount.deletedAt) {
        throw new ConflictException('该账号已被删除，请联系管理员恢复');
      }
      throw new ConflictException('该Facebook账号已存在');
    }

    try {
      // 加密密码（必须存储）
      const encryptedPassword = this.encryptData(createFacebookAccountDto.facebookPassword);

      // 可选字段加密
      const encryptedAccessToken = createFacebookAccountDto.accessToken
        ? this.encryptData(createFacebookAccountDto.accessToken)
        : null;

      // 创建账号实体
      const account = this.facebookAccountsRepository.create({
        userId,
        facebookId: createFacebookAccountDto.facebookId || null,
        name: createFacebookAccountDto.name,
        email: createFacebookAccountDto.email,
        facebookPassword: encryptedPassword,
        accessToken: encryptedAccessToken,
        accessTokenExpiresAt: createFacebookAccountDto.accessTokenExpiresAt
          ? new Date(createFacebookAccountDto.accessTokenExpiresAt)
          : null,
        accountType: createFacebookAccountDto.accountType || 'user',
        messengerPin: createFacebookAccountDto.messengerPin || null,
        remarks: createFacebookAccountDto.remarks,
        verified: createFacebookAccountDto.verified || false,
        config: createFacebookAccountDto.config || {},
        metadata: createFacebookAccountDto.metadata || {},
        status: 'idle',
      });

      // 保存账号
      const savedAccount = await this.facebookAccountsRepository.save(account);

      // 转换为响应DTO
      return this.toResponseDto(savedAccount);
    } catch (error) {
      if (error.code === '23505') {
        // PostgreSQL唯一约束冲突
        throw new ConflictException('Facebook账号创建失败，请检查Facebook ID是否唯一');
      }
      throw new InternalServerErrorException('Facebook账号创建失败，请稍后重试');
    }
  }

  /**
   * 查找用户的所有Facebook账号
   */
  async findAllByUser(
    userId: string,
    page = 1,
    limit = 20,
    filters?: {
      status?: string;
      accountType?: string;
      verified?: boolean;
      search?: string;
    },
  ): Promise<{
    accounts: FacebookAccountResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.facebookAccountsRepository.createQueryBuilder('account');

    // 只查询当前用户的账号
    queryBuilder.where('account.userId = :userId', { userId });

    // 应用过滤器
    if (filters?.status) {
      queryBuilder.andWhere('account.status = :status', { status: filters.status });
    }

    if (filters?.accountType) {
      queryBuilder.andWhere('account.accountType = :accountType', {
        accountType: filters.accountType,
      });
    }

    if (filters?.verified !== undefined) {
      queryBuilder.andWhere('account.verified = :verified', {
        verified: filters.verified,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(account.name ILIKE :search OR account.email ILIKE :search OR account.facebookId ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // 排除已删除的账号
    queryBuilder.andWhere('account.deletedAt IS NULL');

    // 获取总数
    const total = await queryBuilder.getCount();

    // 获取分页数据
    const accounts = await queryBuilder
      .orderBy('account.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return {
      accounts: accounts.map(account => this.toResponseDto(account)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 根据ID查找Facebook账号
   */
  async findOne(userId: string, id: string): Promise<FacebookAccountResponseDto> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${id} 不存在`);
    }

    return this.toResponseDto(account);
  }

  /**
   * 根据Facebook ID查找账号
   */
  async findByFacebookId(userId: string, facebookId: string): Promise<FacebookAccountResponseDto> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { facebookId, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${facebookId} 不存在`);
    }

    return this.toResponseDto(account);
  }

  /**
   * 更新Facebook账号
   */
  async update(
    userId: string,
    id: string,
    updateFacebookAccountDto: UpdateFacebookAccountDto,
  ): Promise<FacebookAccountResponseDto> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${id} 不存在`);
    }

    // 更新访问令牌（如果提供）
    if (updateFacebookAccountDto.accessToken) {
      account.accessToken = this.encryptData(updateFacebookAccountDto.accessToken);
    }

    // 更新刷新令牌（如果提供）
    if (updateFacebookAccountDto.refreshToken !== undefined) {
      account.refreshToken = updateFacebookAccountDto.refreshToken
        ? this.encryptData(updateFacebookAccountDto.refreshToken)
        : null;
    }

    // 更新其他字段
    if (updateFacebookAccountDto.accessTokenExpiresAt) {
      account.accessTokenExpiresAt = new Date(updateFacebookAccountDto.accessTokenExpiresAt);
    }

    // 更新其他可更新字段
    // Handle password update (encrypt if provided)
    if (updateFacebookAccountDto.facebookPassword) {
      account.facebookPassword = this.encryptData(updateFacebookAccountDto.facebookPassword);
    }

    const updatableFields = [
      'name',
      'email',
      'accountType',
      'status',
      'verified',
      'profilePicture',
      'coverPhoto',
      'followersCount',
      'followingCount',
      'syncStatus',
      'syncError',
      'config',
      'metadata',
      'remarks',
      'vpnConfigId',
      'messengerPin',
    ];

    updatableFields.forEach(field => {
      if (updateFacebookAccountDto[field] !== undefined) {
        account[field] = updateFacebookAccountDto[field];
      }
    });

    try {
      const updatedAccount = await this.facebookAccountsRepository.save(account);
      return this.toResponseDto(updatedAccount);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('更新失败，请检查数据唯一性');
      }
      throw new InternalServerErrorException('更新失败，请稍后重试');
    }
  }

  /**
   * 删除Facebook账号（软删除）
   */
  async remove(userId: string, id: string): Promise<void> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${id} 不存在`);
    }

    // 软删除
    await this.facebookAccountsRepository.softDelete(id);
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(
    userId: string,
    id: string,
    newAccessToken: string,
    newExpiresAt: string,
    newRefreshToken?: string,
  ): Promise<FacebookAccountResponseDto> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${id} 不存在`);
    }

    // 更新令牌
    account.accessToken = this.encryptData(newAccessToken);
    account.accessTokenExpiresAt = new Date(newExpiresAt);
    
    if (newRefreshToken) {
      account.refreshToken = this.encryptData(newRefreshToken);
    }

    // 更新状态
    account.status = 'active';
    account.syncStatus = 'success';
    account.syncError = null;

    const updatedAccount = await this.facebookAccountsRepository.save(account);
    return this.toResponseDto(updatedAccount);
  }

  /**
   * 同步账号信息
   */
  async syncAccount(userId: string, id: string): Promise<FacebookAccountResponseDto> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${id} 不存在`);
    }

    // 检查令牌是否有效
    if (account.isTokenExpired()) {
      account.status = 'error';
      account.syncStatus = 'failed';
      account.syncError = '访问令牌已过期';
      await this.facebookAccountsRepository.save(account);
      
      throw new BadRequestException('访问令牌已过期，请重新授权');
    }

    try {
      // 这里应该调用Facebook API同步账号信息
      // 暂时模拟同步成功
      account.lastSyncedAt = new Date();
      account.syncStatus = 'success';
      account.syncError = null;

      const updatedAccount = await this.facebookAccountsRepository.save(account);
      return this.toResponseDto(updatedAccount);
    } catch (error) {
      account.syncStatus = 'failed';
      account.syncError = error.message || '同步失败';
      await this.facebookAccountsRepository.save(account);

      throw new InternalServerErrorException(`同步失败: ${error.message}`);
    }
  }

  /**
   * 获取即将过期的账号
   */
  async getExpiringAccounts(userId: string, thresholdHours = 24): Promise<FacebookAccountResponseDto[]> {
    const thresholdDate = new Date(Date.now() + thresholdHours * 60 * 60 * 1000);

    const accounts = await this.facebookAccountsRepository.find({
      where: {
        userId,
        status: 'active',
        accessTokenExpiresAt: LessThanOrEqual(thresholdDate),
        deletedAt: null,
      },
    });

    return accounts.map(account => this.toResponseDto(account));
  }

  /**
   * 获取账号统计信息
   */
  async getStats(userId: string): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    expiredAccounts: number;
    pageAccounts: number;
    businessAccounts: number;
    verifiedAccounts: number;
    expiringSoon: number;
  }> {
    const queryBuilder = this.facebookAccountsRepository.createQueryBuilder('account');

    queryBuilder.where('account.userId = :userId', { userId });
    queryBuilder.andWhere('account.deletedAt IS NULL');

    const allAccounts = await queryBuilder.getMany();

    const thresholdDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      totalAccounts: allAccounts.length,
      activeAccounts: allAccounts.filter(a => a.status === 'active').length,
      expiredAccounts: allAccounts.filter(a => a.status === 'error').length,
      pageAccounts: allAccounts.filter(a => a.accountType === 'page').length,
      businessAccounts: allAccounts.filter(a => a.accountType === 'business').length,
      verifiedAccounts: allAccounts.filter(a => a.verified).length,
      expiringSoon: allAccounts.filter(a =>
        a.status === 'active' && a.accessTokenExpiresAt <= thresholdDate
      ).length,
    };
  }

  /**
   * 加密数据
   */
  private encryptData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      this.configService.get('encryption.key', 'your-32-character-encryption-key-here'),
      'salt',
      32,
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  /**
   * 解密数据
   */
  private decryptData(encryptedData: string): string {
    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      this.configService.get('encryption.key', 'your-32-character-encryption-key-here'),
      'salt',
      32,
    );
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(account: FacebookAccount): FacebookAccountResponseDto {
    // 检查令牌是否即将过期（24小时内）
    const isTokenExpiring = account.needsRefresh();

    return {
      id: account.id,
      userId: account.userId,
      facebookId: account.facebookId,
      name: account.name,
      email: account.email,
      remarks: account.remarks,
      accountType: account.accountType,
      status: account.status,
      verified: account.verified,
      loginStatus: account.loginStatus,
      profilePicture: account.profilePicture,
      coverPhoto: account.coverPhoto,
      followersCount: account.followersCount,
      followingCount: account.followingCount,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      lastSyncedAt: account.lastSyncedAt,
      syncStatus: account.syncStatus,
      syncError: account.syncError,
      config: account.config,
      metadata: account.metadata,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      isTokenExpiring,
      isActive: account.isActive(),
    };
  }

  /**
   * 获取解密的访问令牌（仅限内部使用）
   */
  async getDecryptedAccessToken(userId: string, id: string): Promise<string> {
    const account = await this.facebookAccountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Facebook账号 ${id} 不存在`);
    }

    // 检查权限
    if (!account.hasPermission('pages_manage_posts')) {
      throw new ForbiddenException('账号没有发布内容的权限');
    }

    return this.decryptData(account.accessToken);
  }

  async getDecryptedPassword(userId: string, id: string): Promise<string> {
    const account = await this.facebookAccountsRepository.findOne({ where: { id, userId } });
    if (!account || !account.facebookPassword) throw new Error('账号不存在或未设置密码');
    try {
      return this.decryptData(account.facebookPassword);
    } catch {
      // If decryption fails, return raw (old plaintext password)
      return account.facebookPassword;
    }
  }
}