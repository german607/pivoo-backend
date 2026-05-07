import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { StorageModule } from '../storage/storage.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), StorageModule, KafkaModule],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy],
})
export class UsersModule {}
