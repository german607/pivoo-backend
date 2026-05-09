import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import {
  NOTIFICATION_TOPICS,
  TournamentRegistrationApprovedEvent,
  TournamentRegistrationRejectedEvent,
  TournamentBracketGeneratedEvent,
  TournamentFinalizedEvent,
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
      clientId: 'complexes-service',
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

  async publishRegistrationApproved(event: TournamentRegistrationApprovedEvent) {
    await this.publish(NOTIFICATION_TOPICS.TOURNAMENT_REGISTRATION_APPROVED, event.userId, event);
  }

  async publishRegistrationRejected(event: TournamentRegistrationRejectedEvent) {
    await this.publish(NOTIFICATION_TOPICS.TOURNAMENT_REGISTRATION_REJECTED, event.userId, event);
  }

  async publishBracketGenerated(event: TournamentBracketGeneratedEvent) {
    await this.publish(NOTIFICATION_TOPICS.TOURNAMENT_BRACKET_GENERATED, event.tournamentId, event);
  }

  async publishTournamentFinalized(event: TournamentFinalizedEvent) {
    await this.publish(NOTIFICATION_TOPICS.TOURNAMENT_FINALIZED, event.tournamentId, event);
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
