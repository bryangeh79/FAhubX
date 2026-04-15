import { Module } from '@nestjs/common';
import { WebSocketGateway } from './gateways/websocket.gateway';
import { ConnectionService } from './services/connection.service';
import { MessageService } from './services/message.service';
import { SubscriptionService } from './services/subscription.service';
import { AuthService } from './services/auth.service';
import { RedisService } from './redis/redis.service';

@Module({
  providers: [
    WebSocketGateway,
    ConnectionService,
    MessageService,
    SubscriptionService,
    AuthService,
    RedisService,
  ],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}