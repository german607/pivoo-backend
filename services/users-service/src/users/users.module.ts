import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), StorageModule],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy],
})
export class UsersModule {}
