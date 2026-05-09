import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ComplexesModule } from './complexes/complexes.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { KafkaProducerModule } from './kafka/kafka-producer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    KafkaProducerModule,
    ComplexesModule,
    TournamentsModule,
  ],
})
export class AppModule {}
