import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ComplexRegisterDto } from './dto/complex-register.dto';
import { ComplexLoginDto } from './dto/complex-login.dto';

@Injectable()
export class ComplexAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: ComplexRegisterDto) {
    const existing = await this.prisma.complexAccount.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.prisma.complexAccount.create({
      data: { email: dto.email, passwordHash, complexId: dto.complexId },
    });

    const tokens = await this.generateTokens(account.id, account.email, account.complexId);
    await this.saveRefreshTokenHash(account.id, tokens.refreshToken);
    return tokens;
  }

  async login(dto: ComplexLoginDto) {
    const account = await this.prisma.complexAccount.findUnique({
      where: { email: dto.email },
    });
    if (!account || !account.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, account.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(account.id, account.email, account.complexId);
    await this.saveRefreshTokenHash(account.id, tokens.refreshToken);
    return tokens;
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string; complexId: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const account = await this.prisma.complexAccount.findUnique({
      where: { id: payload.sub },
    });
    if (!account || !account.refreshTokenHash)
      throw new UnauthorizedException('Invalid refresh token');

    const tokenMatches = await bcrypt.compare(refreshToken, account.refreshTokenHash);
    if (!tokenMatches) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(account.id, account.email, account.complexId);
    await this.saveRefreshTokenHash(account.id, tokens.refreshToken);
    return tokens;
  }

  async logout(accountId: string) {
    await this.prisma.complexAccount.update({
      where: { id: accountId },
      data: { refreshTokenHash: null },
    });
  }

  private async generateTokens(accountId: string, email: string, complexId: string) {
    const payload = { sub: accountId, email, role: 'COMPLEX_ADMIN', complexId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async saveRefreshTokenHash(accountId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.complexAccount.update({
      where: { id: accountId },
      data: { refreshTokenHash },
    });
  }
}
