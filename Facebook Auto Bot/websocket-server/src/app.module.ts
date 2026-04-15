import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSocketModule } from './websocket.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`],
    }),
    LoggerModule,
    RedisModule,
    WebSocketModule,
  ],
})
export class AppModule {}