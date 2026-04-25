import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SkillLevel } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateProfileDto) {
    const existing = await this.prisma.userProfile.findFirst({
      where: { OR: [{ id: userId }, { email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Profile already exists or username taken');

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

  async getRankings(sportId: string, limit = 20) {
    return this.prisma.userSportStats.findMany({
      where: { sportId },
      include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
      orderBy: { rankingPoints: 'desc' },
      take: limit,
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
