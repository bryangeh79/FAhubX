import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarmupService } from './warmup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('账号暖化 (Warmup)')
@Controller('warmup')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WarmupController {
  constructor(private readonly warmupService: WarmupService) {}

  @Get('progress')
  @ApiOperation({ summary: '当前用户所有账号的暖化进度' })
  async listForUser(@Request() req) {
    return this.warmupService.listForUser(req.user.id);
  }

  @Get('status/:accountId')
  @ApiOperation({ summary: '单账号的暖化状态（包/天/下次窗口/错过数）' })
  async getStatus(@Request() req, @Param('accountId') accountId: string) {
    return this.warmupService.getStatus(req.user.id, accountId);
  }

  @Post('start/:accountId')
  @ApiOperation({ summary: '启动/重启暖化（Day 1）' })
  async start(@Request() req, @Param('accountId') accountId: string) {
    return this.warmupService.startWarmup(req.user.id, accountId);
  }

  @Post('retire/:accountId')
  @ApiOperation({ summary: '退役账号（停止暖化）' })
  async retire(@Request() req, @Param('accountId') accountId: string) {
    return this.warmupService.retireWarmup(req.user.id, accountId);
  }

  @Post('resume/:accountId')
  @ApiOperation({ summary: '重新激活退役账号（从上次进度续跑）' })
  async resume(@Request() req, @Param('accountId') accountId: string) {
    return this.warmupService.resumeWarmup(req.user.id, accountId);
  }
}
