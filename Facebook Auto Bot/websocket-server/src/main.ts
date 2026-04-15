import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WebSocketServer');
  const app = await NestFactory.create(AppModule);
  
  // 启用 CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });
  
  // 使用 Socket.io 适配器
  app.useWebSocketAdapter(new IoAdapter(app));
  
  const port = process.env.WS_PORT || 3002;
  await app.listen(port);
  
  logger.log(`WebSocket server is running on port ${port}`);
  logger.log(`WebSocket endpoint: ws://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start WebSocket server:', error);
  process.exit(1);
});