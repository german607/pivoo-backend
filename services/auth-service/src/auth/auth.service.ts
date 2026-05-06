import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcryptjs';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly usersServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private http: HttpService,
  ) {
    this.usersServiceUrl = this.config.get('USERS_SERVICE_URL') ?? 'http://users-service:3002';
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.authUser.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.authUser.create({
      data: { email: dto.email, passwordHash },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.authUser.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) throw new BadRequestException('This account uses social login');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async loginWithOAuth(profile: {
    provider: string;
    providerId: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    let isNewUser = false;

    let user = await this.prisma.authUser.findFirst({
      where: { provider: profile.provider, providerId: profile.providerId },
    });

    if (!user && profile.email) {
      const byEmail = await this.prisma.authUser.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        user = await this.prisma.authUser.update({
          where: { id: byEmail.id },
          data: { provider: profile.provider, providerId: profile.providerId },
        });
      }
    }

    if (!user) {
      user = await this.prisma.authUser.create({
        data: {
          email: profile.email,
          provider: profile.provider,
          providerId: profile.providerId,
        },
      });
      isNewUser = true;
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    if (isNewUser) {
      await this.createUserProfile(user.id, tokens.accessToken, profile);
    }

    return tokens;
  }

  private async createUserProfile(
    userId: string,
    accessToken: string,
    profile: { email: string; displayName?: string; avatarUrl?: string },
  ) {
    const username = profile.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + userId.slice(0, 6);
    const name = profile.displayName ?? profile.email.split('@')[0];

    await firstValueFrom(
      this.http.post(
        `${this.usersServiceUrl}/api/v1/users`,
        { email: profile.email, username, name, avatarUrl: profile.avatarUrl ?? null },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    ).catch(() => null);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.authUser.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('Invalid refresh token');

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!tokenMatches) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.authUser.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      return { userId: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
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

  private async saveRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.authUser.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
