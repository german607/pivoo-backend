import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), HttpModule],
  controllers: [MatchesController],
  providers: [MatchesService, JwtStrategy],
})
export class MatchesModule {}
