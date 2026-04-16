import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { FacebookAccountsService } from './facebook-accounts.service';
import { FacebookLoginService } from './facebook-login.service';
import { CreateFacebookAccountDto } from './dto/create-facebook-account.dto';
import { UpdateFacebookAccountDto } from './dto/update-facebook-account.dto';
import { FacebookAccountResponseDto } from './dto/facebook-account-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SyncAccountDto } from './dto/sync-account.dto';

@ApiTags('Facebook账号管理')
@Controller('facebook-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FacebookAccountsController {
  constructor(
    private readonly facebookAccountsService: FacebookAccountsService,
    private readonly facebookLoginService: FacebookLoginService,
  ) {}

  @Post()
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: '创建Facebook账号' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '创建成功',
    type: FacebookAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Facebook账号已存在',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '请求参数错误',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async create(
    @Request() req,
    @Body() createFacebookAccountDto: CreateFacebookAccountDto,
  ): Promise<FacebookAccountResponseDto> {
    return this.facebookAccountsService.create(req.user.id, createFacebookAccountDto);
  }

  @Get()
  @ApiOperation({ summary: '获取用户的所有Facebook账号' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '页码',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '每页数量',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: '账号状态过滤',
    example: 'active',
  })
  @ApiQuery({
    name: 'accountType',
    required: false,
    description: '账号类型过滤',
    example: 'page',
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    description: '是否已验证过滤',
    example: true,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '搜索关键词',
    example: 'John',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async findAll(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('accountType') accountType?: string,
    @Query('verified') verified?: boolean,
    @Query('search') search?: string,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (accountType) filters.accountType = accountType;
    if (verified !== undefined) filters.verified = verified === true;
    if (search) filters.search = search;

    return this.facebookAccountsService.findAllByUser(
      req.user.id,
      parseInt(page.toString(), 10),
      parseInt(limit.toString(), 10),
      filters,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: '获取账号统计信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async getStats(@Request() req) {
    return this.facebookAccountsService.getStats(req.user.id);
  }

  @Get('expiring')
  @ApiOperation({ summary: '获取即将过期的账号' })
  @ApiQuery({
    name: 'thresholdHours',
    required: false,
    description: '过期阈值（小时）',
    example: 24,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async getExpiringAccounts(
    @Request() req,
    @Query('thresholdHours') thresholdHours = 24,
  ) {
    return this.facebookAccountsService.getExpiringAccounts(
      req.user.id,
      parseInt(thresholdHours.toString(), 10),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取Facebook账号' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: FacebookAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async findOne(@Request() req, @Param('id') id: string): Promise<FacebookAccountResponseDto> {
    return this.facebookAccountsService.findOne(req.user.id, id);
  }

  @Get('facebook/:facebookId')
  @ApiOperation({ summary: '根据Facebook ID获取账号' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: FacebookAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async findByFacebookId(
    @Request() req,
    @Param('facebookId') facebookId: string,
  ): Promise<FacebookAccountResponseDto> {
    return this.facebookAccountsService.findByFacebookId(req.user.id, facebookId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新Facebook账号' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '更新成功',
    type: FacebookAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '请求参数错误',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateFacebookAccountDto: UpdateFacebookAccountDto,
  ): Promise<FacebookAccountResponseDto> {
    return this.facebookAccountsService.update(req.user.id, id, updateFacebookAccountDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除Facebook账号' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '删除成功',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async remove(@Request() req, @Param('id') id: string): Promise<void> {
    await this.facebookAccountsService.remove(req.user.id, id);
  }

  @Post(':id/refresh-token')
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '刷新成功',
    type: FacebookAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '请求参数错误',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async refreshToken(
    @Request() req,
    @Param('id') id: string,
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<FacebookAccountResponseDto> {
    return this.facebookAccountsService.refreshAccessToken(
      req.user.id,
      id,
      refreshTokenDto.newAccessToken,
      refreshTokenDto.newExpiresAt,
      refreshTokenDto.newRefreshToken,
    );
  }

  @Post(':id/sync')
  @ApiOperation({ summary: '同步账号信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '同步成功',
    type: FacebookAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '令牌已过期',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async syncAccount(
    @Request() req,
    @Param('id') id: string,
    @Body() syncAccountDto: SyncAccountDto,
  ): Promise<FacebookAccountResponseDto> {
    return this.facebookAccountsService.syncAccount(req.user.id, id);
  }

  @Post(':id/login')
  @ApiOperation({ summary: '通过用户名密码自动登录Facebook（Puppeteer，每账号独立浏览器容器+VPN代理）' })
  async loginAccount(@Request() req, @Param('id') id: string) {
    return this.facebookLoginService.login(req.user.id, id);
  }

  @Post(':id/logout')
  @ApiOperation({ summary: '登出Facebook账号（清除Session + 关闭浏览器容器）' })
  async logoutAccount(@Request() req, @Param('id') id: string) {
    await this.facebookLoginService.logout(req.user.id, id);
    return { message: '已登出' };
  }

  @Get(':id/login-status')
  @ApiOperation({ summary: '检查账号登录状态' })
  async getLoginStatus(@Request() req, @Param('id') id: string) {
    return this.facebookLoginService.checkLoginStatus(req.user.id, id);
  }

  @Post(':id/validate-session')
  @ApiOperation({ summary: '实际打开浏览器探测会话是否仍有效' })
  async validateSession(@Request() req, @Param('id') id: string) {
    return this.facebookLoginService.validateSession(req.user.id, id);
  }

  @Get(':id/access-token')
  @ApiOperation({ summary: '获取解密的访问令牌（仅限内部使用）' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '账号不存在',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '没有权限',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '未授权访问',
  })
  async getAccessToken(@Request() req, @Param('id') id: string): Promise<{ accessToken: string }> {
    const accessToken = await this.facebookAccountsService.getDecryptedAccessToken(
      req.user.id,
      id,
    );
    return { accessToken };
  }
}