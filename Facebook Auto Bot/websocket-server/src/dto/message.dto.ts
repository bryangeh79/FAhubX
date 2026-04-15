import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class WebSocketMessageDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsObject()
  @IsOptional()
  data?: any;

  @IsString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  channel: string;
}

export class UnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  channel: string;
}

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class PingDto {
  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class PongDto {
  @IsString()
  @IsNotEmpty()
  timestamp: string;
}