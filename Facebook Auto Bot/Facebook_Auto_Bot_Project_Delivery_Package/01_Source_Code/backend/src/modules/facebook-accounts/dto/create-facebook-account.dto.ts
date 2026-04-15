import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsObject,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateFacebookAccountDto {
  @ApiProperty({
    description: 'Facebook账号ID',
    example: '123456789012345',
  })
  @IsString({ message: 'Facebook账号ID必须是字符串' })
  @IsNotEmpty({ message: 'Facebook账号ID不能为空' })
  facebookId: string;

  @ApiProperty({
    description: 'Facebook账号名称',
    example: 'John Doe',
  })
  @IsString({ message: '账号名称必须是字符串' })
  @IsNotEmpty({ message: '账号名称不能为空' })
  name: string;

  @ApiProperty({
    description: '访问令牌',
    example: 'EAAG...',
  })
  @IsString({ message: '访问令牌必须是字符串' })
  @IsNotEmpty({ message: '访问令牌不能为空' })
  accessToken: string;

  @ApiProperty({
    description: '访问令牌过期时间',
    example: '2026-05-12T10:30:00Z',
  })
  @IsDateString({}, { message: '令牌过期时间必须是有效的日期字符串' })
  @IsNotEmpty({ message: '令牌过期时间不能为空' })
  accessTokenExpiresAt: string;

  @ApiProperty({
    description: '刷新令牌',
    example: 'EAAG...',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({
    description: 'Facebook邮箱',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: '账号类型',
    example: 'user',
    enum: ['user', 'page', 'business'],
  })
  @IsString()
  @IsIn(['user', 'page', 'business'], {
    message: '账号类型必须是 user, page 或 business',
  })
  accountType: 'user' | 'page' | 'business';

  @ApiProperty({
    description: '头像URL',
    example: 'https://graph.facebook.com/123456789012345/picture',
    required: false,
  })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiProperty({
    description: '封面照片URL',
    example: 'https://example.com/cover.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @ApiProperty({
    description: '粉丝/好友数量',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  followersCount?: number;

  @ApiProperty({
    description: '关注数量',
    example: 500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  followingCount?: number;

  @ApiProperty({
    description: '是否已验证',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiProperty({
    description: '账号配置',
    example: {
      autoPost: true,
      autoReply: false,
      postSchedule: '9:00,13:00,18:00',
      replyTemplates: ['谢谢关注！', '请查看我们的网站了解更多信息。'],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiProperty({
    description: '元数据',
    example: {
      permissions: ['pages_manage_posts', 'pages_read_engagement'],
      scopes: ['email', 'public_profile'],
      grantedAt: '2026-04-12T10:00:00Z',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}