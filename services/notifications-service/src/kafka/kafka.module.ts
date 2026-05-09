import { Module, OnModuleInit } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [KafkaService],
})
export class KafkaModule implements OnModuleInit {
  constructor(private readonly kafka: KafkaService) {}

  async onModuleInit() {
    await this.kafka.startConsuming();
  }
}
