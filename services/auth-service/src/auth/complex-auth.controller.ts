import {
  Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ComplexAuthService } from './complex-auth.service';
import { ComplexRegisterDto } from './dto/complex-register.dto';
import { ComplexLoginDto } from './dto/complex-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('complex-auth')
@Controller('auth/complex')
export class ComplexAuthController {
  constructor(private complexAuthService: ComplexAuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a complex admin account' })
  @ApiResponse({ status: 201, description: 'Complex account registered' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: ComplexRegisterDto) {
    return this.complexAuthService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login as complex admin — returns JWT with role=COMPLEX_ADMIN' })
  @ApiResponse({ status: 200, description: 'Returns access and refresh tokens' })
  login(@Body() dto: ComplexLoginDto) {
    return this.complexAuthService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh complex admin access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.complexAuthService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout complex admin' })
  logout(@Request() req: any) {
    return this.complexAuthService.logout(req.user.userId);
  }
}
