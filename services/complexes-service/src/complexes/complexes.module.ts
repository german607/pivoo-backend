import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ComplexesController } from './complexes.controller';
import { ComplexesService } from './complexes.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [ComplexesController],
  providers: [ComplexesService, JwtStrategy],
})
export class ComplexesModule {}
