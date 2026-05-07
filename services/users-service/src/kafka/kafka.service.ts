import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';

export const AVATAR_UPLOADED_TOPIC = 'user.avatar.uploaded';

export interface AvatarUploadedEvent {
  userId: string;
  avatarUrl: string;
}

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;

  constructor(config: ConfigService) {
    const brokers = config.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka disabled');
      return;
    }

    const kafka = new Kafka({
      clientId: 'users-service',
      brokers: brokers.split(','),
      logLevel: logLevel.WARN,
      ssl: false,
    });

    this.producer = kafka.producer();
    this.consumer = kafka.consumer({
      groupId: 'users-service-avatar',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async startConsuming(handler: (event: AvatarUploadedEvent) => Promise<void>) {
    if (!this.consumer) return;
    try {
      await this.producer!.connect();
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: AVATAR_UPLOADED_TOPIC, fromBeginning: false });
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
      this.logger.log('Kafka consumer running');
    } catch (err) {
      this.logger.error('Kafka connection failed — avatar events disabled', err);
      this.producer = null;
      this.consumer = null;
    }
  }

  async publishAvatarUploaded(event: AvatarUploadedEvent) {
    if (!this.producer) return;
    await this.producer.send({
      topic: AVATAR_UPLOADED_TOPIC,
      messages: [{ key: event.userId, value: JSON.stringify(event) }],
    });
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
    await this.consumer?.disconnect();
  }
}
