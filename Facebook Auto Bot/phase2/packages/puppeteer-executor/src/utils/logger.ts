import winston from 'winston';
import dayjs from 'dayjs';

const { combine, timestamp, printf, colorize, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, sessionId, ...meta }) => {
  const ts = dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  const session = sessionId ? `[${sessionId}]` : '[SYSTEM]';
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level} ${session} ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

export class SessionLogger {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  info(message: string, meta?: any) {
    logger.info(message, { sessionId: this.sessionId, ...meta });
  }

  error(message: string, error?: Error, meta?: any) {
    logger.error(message, { 
      sessionId: this.sessionId, 
      error: error?.message, 
      stack: error?.stack,
      ...meta 
    });
  }

  warn(message: string, meta?: any) {
    logger.warn(message, { sessionId: this.sessionId, ...meta });
  }

  debug(message: string, meta?: any) {
    logger.debug(message, { sessionId: this.sessionId, ...meta });
  }
}