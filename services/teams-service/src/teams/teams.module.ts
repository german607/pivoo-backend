import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), HttpModule],
  controllers: [TeamsController],
  providers: [TeamsService, JwtStrategy],
})
export class TeamsModule {}
