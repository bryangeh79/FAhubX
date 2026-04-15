import { Module, Global } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: 'LOGGER',
      useFactory: () => {
        return createLogger({
          level: process.env.LOG_LEVEL || 'info',
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.splat(),
            format.json(),
          ),
          defaultMeta: { service: 'websocket-server' },
          transports: [
            new transports.Console({
              format: format.combine(
                format.colorize(),
                format.simple(),
              ),
            }),
            new transports.File({ 
              filename: 'logs/websocket-error.log', 
              level: 'error' 
            }),
            new transports.File({ 
              filename: 'logs/websocket-combined.log' 
            }),
          ],
        });
      },
    },
    LoggerService,
  ],
  exports: ['LOGGER', LoggerService],
})
export class LoggerModule {}