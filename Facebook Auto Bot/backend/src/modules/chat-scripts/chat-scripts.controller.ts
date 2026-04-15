import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatScriptsService } from './chat-scripts.service';
import { UpdateChatScriptDto } from './dto/update-chat-script.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('聊天剧本')
@Controller('chat-scripts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatScriptsController {
  constructor(private readonly service: ChatScriptsService) {}

  @Get()
  @ApiOperation({ summary: '获取用户所有50个聊天剧本' })
  async findAll(@Request() req) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个剧本详情' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新剧本内容' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateChatScriptDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }
}
