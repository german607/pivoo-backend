import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';

export const AVATAR_UPLOADED_TOPIC = 'user.avatar.uploaded';

export interface AvatarUploadedEvent {
  userId: string;
  avatarUrl: string;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const brokers = config.get<string>('KAFKA_BROKERS');
    this.enabled = !!brokers;

    if (brokers) {
      this.kafka = new Kafka({
        clientId: 'users-service',
        brokers: brokers.split(','),
        logLevel: logLevel.WARN,
        // Railway internal network uses plaintext — no SSL needed
        ssl: false,
      });
      this.producer = this.kafka.producer();
      this.consumer = this.kafka.consumer({ groupId: 'users-service-avatar' });
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka disabled');
      return;
    }
    await this.producer!.connect();
    await this.consumer!.connect();
    await this.consumer!.subscribe({ topic: AVATAR_UPLOADED_TOPIC, fromBeginning: false });
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
    await this.consumer?.disconnect();
  }

  async publishAvatarUploaded(event: AvatarUploadedEvent) {
    if (!this.producer) return;
    await this.producer.send({
      topic: AVATAR_UPLOADED_TOPIC,
      messages: [{ key: event.userId, value: JSON.stringify(event) }],
    });
  }

  async startConsuming(handler: (event: AvatarUploadedEvent) => Promise<void>) {
    if (!this.consumer) return;
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const event: AvatarUploadedEvent = JSON.parse(message.value!.toString());
          await handler(event);
        } catch (err) {
          this.logger.error('Error processing avatar event', err);
        }
      },
    });
  }
}
