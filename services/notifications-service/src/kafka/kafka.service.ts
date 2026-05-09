import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import { NotificationsService } from '../notifications/notifications.service';
import {
  TOPICS,
  MatchPlayerInvitedEvent,
  MatchJoinRequestedEvent,
  MatchJoinApprovedEvent,
  MatchWaitlistPromotedEvent,
  MatchJoinRejectedEvent,
  MatchCancelledEvent,
  MatchResultRecordedEvent,
  TournamentRegistrationApprovedEvent,
  TournamentRegistrationRejectedEvent,
  TournamentBracketGeneratedEvent,
  TournamentFinalizedEvent,
  UserFollowedEvent,
} from './events';

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private consumer: Consumer | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async startConsuming() {
    const brokers = this.config.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka consumer disabled');
      return;
    }

    const kafka = new Kafka({
      clientId: 'notifications-service',
      brokers: brokers.split(','),
      logLevel: logLevel.WARN,
      ssl: false,
    });

    const allTopics = Object.values(TOPICS);

    // Pre-create topics so the consumer doesn't fail when they don't exist yet
    const admin = kafka.admin();
    try {
      await admin.connect();
      await admin.createTopics({
        waitForLeaders: true,
        topics: allTopics.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
      });
    } catch (err) {
      this.logger.warn('Could not pre-create topics (may already exist)', err);
    } finally {
      await admin.disconnect();
    }

    this.consumer = kafka.consumer({
      groupId: 'notifications-service',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    try {
      await this.consumer.connect();

      for (const topic of allTopics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
      }

      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          if (!message.value) return;
          try {
            const payload = JSON.parse(message.value.toString());
            await this.route(topic, payload);
          } catch (err) {
            this.logger.error(`Error processing message from ${topic}`, err);
          }
        },
      });

      this.logger.log('Kafka consumer running — subscribed to all notification topics');
    } catch (err) {
      this.logger.error('Kafka connection failed — notifications from events disabled', err);
      this.consumer = null;
    }
  }

  private async route(topic: string, payload: unknown) {
    switch (topic) {
      case TOPICS.MATCH_PLAYER_INVITED:
        await this.notifications.handleMatchPlayerInvited(payload as MatchPlayerInvitedEvent);
        break;
      case TOPICS.MATCH_JOIN_REQUESTED:
        await this.notifications.handleMatchJoinRequested(payload as MatchJoinRequestedEvent);
        break;
      case TOPICS.MATCH_WAITLIST_PROMOTED:
        await this.notifications.handleMatchWaitlistPromoted(payload as MatchWaitlistPromotedEvent);
        break;
      case TOPICS.MATCH_JOIN_APPROVED:
        await this.notifications.handleMatchJoinApproved(payload as MatchJoinApprovedEvent);
        break;
      case TOPICS.MATCH_JOIN_REJECTED:
        await this.notifications.handleMatchJoinRejected(payload as MatchJoinRejectedEvent);
        break;
      case TOPICS.MATCH_CANCELLED:
        await this.notifications.handleMatchCancelled(payload as MatchCancelledEvent);
        break;
      case TOPICS.MATCH_RESULT_RECORDED:
        await this.notifications.handleMatchResultRecorded(payload as MatchResultRecordedEvent);
        break;
      case TOPICS.TOURNAMENT_REGISTRATION_APPROVED:
        await this.notifications.handleTournamentRegistrationApproved(
          payload as TournamentRegistrationApprovedEvent,
        );
        break;
      case TOPICS.TOURNAMENT_REGISTRATION_REJECTED:
        await this.notifications.handleTournamentRegistrationRejected(
          payload as TournamentRegistrationRejectedEvent,
        );
        break;
      case TOPICS.TOURNAMENT_BRACKET_GENERATED:
        await this.notifications.handleTournamentBracketGenerated(
          payload as TournamentBracketGeneratedEvent,
        );
        break;
      case TOPICS.TOURNAMENT_FINALIZED:
        await this.notifications.handleTournamentFinalized(payload as TournamentFinalizedEvent);
        break;
      case TOPICS.USER_FOLLOWED:
        await this.notifications.handleUserFollowed(payload as UserFollowedEvent);
        break;
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
