import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import {
  NOTIFICATION_TOPICS,
  MatchPlayerInvitedEvent,
  MatchJoinApprovedEvent,
  MatchJoinRejectedEvent,
  MatchCancelledEvent,
  MatchResultRecordedEvent,
} from './notification-events';

@Injectable()
export class KafkaProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer | null = null;

  constructor(config: ConfigService) {
    const brokers = config.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — notification events disabled');
      return;
    }

    const kafka = new Kafka({
      clientId: 'matches-service',
      brokers: brokers.split(','),
      logLevel: logLevel.WARN,
      ssl: false,
    });

    this.producer = kafka.producer();
    this.producer.connect().catch((err) => {
      this.logger.error('Kafka producer connection failed', err);
      this.producer = null;
    });
  }

  async publishMatchPlayerInvited(event: MatchPlayerInvitedEvent) {
    await this.publish(NOTIFICATION_TOPICS.MATCH_PLAYER_INVITED, event.invitedUserId, event);
  }

  async publishMatchJoinApproved(event: MatchJoinApprovedEvent) {
    await this.publish(NOTIFICATION_TOPICS.MATCH_JOIN_APPROVED, event.userId, event);
  }

  async publishMatchJoinRejected(event: MatchJoinRejectedEvent) {
    await this.publish(NOTIFICATION_TOPICS.MATCH_JOIN_REJECTED, event.userId, event);
  }

  async publishMatchCancelled(event: MatchCancelledEvent) {
    await this.publish(NOTIFICATION_TOPICS.MATCH_CANCELLED, event.matchId, event);
  }

  async publishMatchResultRecorded(event: MatchResultRecordedEvent) {
    await this.publish(NOTIFICATION_TOPICS.MATCH_RESULT_RECORDED, event.matchId, event);
  }

  private async publish(topic: string, key: string, payload: unknown) {
    if (!this.producer) return;
    try {
      await this.producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(payload) }],
      });
    } catch (err) {
      this.logger.error(`Failed to publish to ${topic}`, err);
    }
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
  }
}
