import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { KafkaService } from '../kafka/kafka.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSportStatsDto } from './dto/update-sport-stats.dto';
import { SkillLevel } from '../generated/prisma';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private kafka: KafkaService,
  ) {}

  async onModuleInit() {
    await this.kafka.startConsuming(async ({ userId, avatarUrl }) => {
      await this.prisma.userProfile.update({
        where: { id: userId },
        data: { avatarUrl },
      });
    });
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    const byId = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (byId) throw new ConflictException('profile_exists');

    const byEmail = await this.prisma.userProfile.findUnique({ where: { email: dto.email } });
    if (byEmail) throw new ConflictException('email_taken');

    const byUsername = await this.prisma.userProfile.findUnique({ where: { username: dto.username } });
    if (byUsername) throw new ConflictException('username_taken');

    return this.prisma.userProfile.create({
      data: { id: userId, ...dto },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.userProfile.findUnique({
      where: { id },
      include: { sportStats: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.userProfile.findUnique({
      where: { username },
      include: { sportStats: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.findById(userId);
    return this.prisma.userProfile.update({
      where: { id: userId },
      data: dto,
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    await this.findById(userId);
    const avatarUrl = await this.storage.uploadProfileImage(userId, file);
    await this.kafka.publishAvatarUploaded({ userId, avatarUrl });
    return { avatarUrl };
  }

  async getRankings(sportId: string, limit = 20) {
    return this.prisma.userSportStats.findMany({
      where: { sportId },
      include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      orderBy: { rankingPoints: 'desc' },
      take: limit,
    });
  }

  async updateMySportStats(userId: string, sportId: string, dto: UpdateSportStatsDto) {
    return this.prisma.userSportStats.upsert({
      where: { userId_sportId: { userId, sportId } },
      update: {
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
      },
      create: {
        userId,
        sportId,
        level: dto.level ?? SkillLevel.BEGINNER,
        category: dto.category ?? null,
      },
    });
  }

  async updateStatsAfterMatch(
    userId: string,
    sportId: string,
    won: boolean,
    pointsDelta: number,
  ) {
    const stats = await this.prisma.userSportStats.upsert({
      where: { userId_sportId: { userId, sportId } },
      update: {
        matchesPlayed: { increment: 1 },
        matchesWon: won ? { increment: 1 } : undefined,
        rankingPoints: { increment: pointsDelta },
      },
      create: {
        userId,
        sportId,
        matchesPlayed: 1,
        matchesWon: won ? 1 : 0,
        rankingPoints: 1000 + pointsDelta,
        level: SkillLevel.BEGINNER,
      },
    });

    await this.recalculateLevel(userId, sportId, stats.rankingPoints);
    return stats;
  }

  private async recalculateLevel(userId: string, sportId: string, points: number) {
    let level: SkillLevel;
    if (points >= 2000) level = SkillLevel.PROFESSIONAL;
    else if (points >= 1500) level = SkillLevel.ADVANCED;
    else if (points >= 1200) level = SkillLevel.INTERMEDIATE;
    else level = SkillLevel.BEGINNER;

    await this.prisma.userSportStats.update({
      where: { userId_sportId: { userId, sportId } },
      data: { level },
    });
  }
}
