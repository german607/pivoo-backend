import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SportsController } from './sports.controller';
import { SportsService } from './sports.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [SportsController],
  providers: [SportsService, JwtStrategy],
})
export class SportsModule {}
