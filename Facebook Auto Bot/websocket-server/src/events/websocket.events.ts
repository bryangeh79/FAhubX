export class ClientConnectedEvent {
  constructor(
    public readonly clientId: string,
    public readonly userId?: string,
    public readonly metadata?: Record<string, any>,
  ) {}
}

export class ClientDisconnectedEvent {
  constructor(
    public readonly clientId: string,
    public readonly userId?: string,
    public readonly reason?: string,
  ) {}
}

export class MessageReceivedEvent {
  constructor(
    public readonly clientId: string,
    public readonly message: any,
    public readonly timestamp: Date,
  ) {}
}

export class MessageSentEvent {
  constructor(
    public readonly clientId: string,
    public readonly message: any,
    public readonly timestamp: Date,
  ) {}
}

export class SubscriptionAddedEvent {
  constructor(
    public readonly clientId: string,
    public readonly channel: string,
    public readonly timestamp: Date,
  ) {}
}

export class SubscriptionRemovedEvent {
  constructor(
    public readonly clientId: string,
    public readonly channel: string,
    public readonly timestamp: Date,
  ) {}
}

export class HeartbeatMissedEvent {
  constructor(
    public readonly clientId: string,
    public readonly missedCount: number,
    public readonly timestamp: Date,
  ) {}
}

export class ConnectionStatsEvent {
  constructor(
    public readonly stats: {
      totalConnections: number;
      activeConnections: number;
      totalMessages: number;
      messagesPerSecond: number;
      averageLatency: number;
    },
    public readonly timestamp: Date,
  ) {}
}