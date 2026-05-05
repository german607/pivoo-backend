import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ComplexAuthService } from './complex-auth.service';
import { ComplexAuthController } from './complex-auth.controller';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { GoogleStrategy } from '../common/strategies/google.strategy';
import { FacebookStrategy } from '../common/strategies/facebook.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  providers: [AuthService, ComplexAuthService, JwtStrategy, GoogleStrategy, FacebookStrategy],
  controllers: [AuthController, ComplexAuthController],
})
export class AuthModule {}
