import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { MatchStatus, ParticipantStatus, ParticipantType, Team } from '../generated/prisma';

@Injectable()
export class MatchesService {
  private readonly usersServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.usersServiceUrl = this.config.get('USERS_SERVICE_URL') ?? 'http://users-service:3002';
  }

  // ──────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────

  async findAll(filters: { sportId?: string; complexId?: string; status?: MatchStatus }) {
    return this.prisma.match.findMany({
      where: {
        sportId: filters.sportId,
        complexId: filters.complexId,
        status: filters.status ?? MatchStatus.OPEN,
      },
      include: {
        participants: {
          where: { status: ParticipantStatus.APPROVED },
          select: {
            id: true,
            userId: true,
            participantType: true,
            guestFirstName: true,
            guestLastName: true,
            team: true,
          },
        },
        _count: {
          select: { participants: { where: { status: ParticipantStatus.APPROVED } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        participants: {
          select: {
            id: true,
            userId: true,
            participantType: true,
            guestFirstName: true,
            guestLastName: true,
            status: true,
            team: true,
            joinedAt: true,
          },
        },
        result: true,
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  // ──────────────────────────────────────────────────────────
  // Match lifecycle
  // ──────────────────────────────────────────────────────────

  async create(adminUserId: string, dto: CreateMatchDto) {
    const hasLevel = dto.requiredLevel !== undefined;
    const hasCategory = dto.requiredCategory !== undefined;
    if (!hasLevel && !hasCategory) {
      throw new BadRequestException('Debe indicar nivel o categoría');
    }
    if (hasLevel && hasCategory) {
      throw new BadRequestException('No puede indicar nivel y categoría al mismo tiempo');
    }

    return this.prisma.match.create({
      data: {
        ...dto,
        adminUserId,
        scheduledAt: new Date(dto.scheduledAt),
        participants: {
          create: {
            userId: adminUserId,
            participantType: ParticipantType.REGISTERED,
            status: ParticipantStatus.APPROVED,
            team: Team.TEAM_A,
          },
        },
      },
      include: { participants: true },
    });
  }

  async cancelMatch(matchId: string, adminUserId: string) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can cancel');
    }
    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match cannot be cancelled');
    }
    return this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED },
    });
  }

  // ──────────────────────────────────────────────────────────
  // Registered user — request to join
  // ──────────────────────────────────────────────────────────

  async requestToJoin(matchId: string, userId: string) {
    const match = await this.findOne(matchId);

    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('Match is not open for requests');
    }
    if (match.adminUserId === userId) {
      throw new BadRequestException('Admin is already in the match');
    }

    const existing = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId },
    });
    if (existing) throw new ConflictException('Already requested or invited to this match');

    return this.prisma.matchParticipant.create({
      data: {
        matchId,
        userId,
        participantType: ParticipantType.REGISTERED,
        status: ParticipantStatus.PENDING,
      },
    });
  }

  async respondToRequest(
    matchId: string,
    participantUserId: string,
    adminUserId: string,
    approve: boolean,
    team?: Team,
  ) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can approve or reject requests');
    }

    const participant = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId: participantUserId, status: ParticipantStatus.PENDING },
    });
    if (!participant) throw new NotFoundException('Pending request not found');

    if (approve) {
      await this.assertSlotAvailable(matchId, match.maxPlayers);
    }

    const updated = await this.prisma.matchParticipant.update({
      where: { id: participant.id },
      data: {
        status: approve ? ParticipantStatus.APPROVED : ParticipantStatus.REJECTED,
        team: approve ? (team ?? null) : null,
      },
    });

    if (approve) {
      await this.syncMatchFullStatus(matchId, match.maxPlayers);
    }

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // Invite flow (admin → registered user)
  // ──────────────────────────────────────────────────────────

  async inviteUser(matchId: string, adminUserId: string, dto: InviteUserDto) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can invite players');
    }
    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('Match is not open');
    }
    if (dto.userId === adminUserId) {
      throw new BadRequestException('Admin is already in the match');
    }

    const existing = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User already has a participation record in this match');
    }

    await this.assertSlotAvailable(matchId, match.maxPlayers);

    return this.prisma.matchParticipant.create({
      data: {
        matchId,
        userId: dto.userId,
        participantType: ParticipantType.REGISTERED,
        status: ParticipantStatus.INVITED,
        team: dto.team ?? null,
      },
    });
  }

  async acceptInvite(matchId: string, userId: string) {
    const participant = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId, status: ParticipantStatus.INVITED },
    });
    if (!participant) throw new NotFoundException('Invite not found');

    const match = await this.findOne(matchId);
    await this.assertSlotAvailable(matchId, match.maxPlayers);

    const updated = await this.prisma.matchParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.APPROVED },
    });

    await this.syncMatchFullStatus(matchId, match.maxPlayers);
    return updated;
  }

  async declineInvite(matchId: string, userId: string) {
    const participant = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId, status: ParticipantStatus.INVITED },
    });
    if (!participant) throw new NotFoundException('Invite not found');

    return this.prisma.matchParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.REJECTED },
    });
  }

  // ──────────────────────────────────────────────────────────
  // Guest flow (admin adds by name / surname)
  // ──────────────────────────────────────────────────────────

  async addGuest(matchId: string, adminUserId: string, dto: AddGuestDto) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can add guest players');
    }
    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('Match is not open');
    }

    await this.assertSlotAvailable(matchId, match.maxPlayers);

    const guest = await this.prisma.matchParticipant.create({
      data: {
        matchId,
        userId: null,
        participantType: ParticipantType.GUEST,
        guestFirstName: dto.firstName,
        guestLastName: dto.lastName,
        status: ParticipantStatus.APPROVED,
        team: dto.team ?? null,
      },
    });

    await this.syncMatchFullStatus(matchId, match.maxPlayers);
    return guest;
  }

  // ──────────────────────────────────────────────────────────
  // Remove participant (admin removes anyone)
  // ──────────────────────────────────────────────────────────

  async removeParticipant(matchId: string, participantId: string, adminUserId: string) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can remove participants');
    }

    const participant = await this.prisma.matchParticipant.findFirst({
      where: { id: participantId, matchId },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    if (participant.userId === adminUserId) {
      throw new BadRequestException('Admin cannot remove themselves from the match');
    }

    await this.prisma.matchParticipant.delete({ where: { id: participantId } });

    // If match was FULL and we just freed a slot, reopen it
    if (
      match.status === MatchStatus.FULL &&
      participant.status === ParticipantStatus.APPROVED
    ) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.OPEN },
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // Team stats (called by teams-service)
  // ──────────────────────────────────────────────────────────

  async getTeamStats(userIds: string[], sportId?: string) {
    // Get all COMPLETED matches where at least one team member participated
    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        ...(sportId && { sportId }),
        participants: {
          some: {
            userId: { in: userIds },
            status: ParticipantStatus.APPROVED,
            participantType: ParticipantType.REGISTERED,
          },
        },
      },
      include: {
        // Only include the team members we care about
        participants: {
          where: {
            status: ParticipantStatus.APPROVED,
            participantType: ParticipantType.REGISTERED,
            userId: { in: userIds },
          },
        },
        result: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });

    // A match counts as a "team match" when 2+ members played on the SAME side
    const teamMatches = matches.filter((match) => {
      const teamA = match.participants.filter((p) => p.team === Team.TEAM_A).length;
      const teamB = match.participants.filter((p) => p.team === Team.TEAM_B).length;
      return teamA >= 2 || teamB >= 2;
    });

    let matchesPlayed = 0;
    let matchesWon = 0;

    for (const match of teamMatches) {
      if (!match.result) continue;

      const teamA = match.participants.filter((p) => p.team === Team.TEAM_A).length;
      const teamB = match.participants.filter((p) => p.team === Team.TEAM_B).length;
      const ourSide = teamA >= teamB ? Team.TEAM_A : Team.TEAM_B;

      matchesPlayed++;
      if (match.result.winnerTeam === ourSide) matchesWon++;
    }

    return {
      matchesPlayed,
      matchesWon,
      matchesLost: matchesPlayed - matchesWon,
      winRate: matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0,
      recentMatches: teamMatches.slice(0, 5).map((m) => ({
        id: m.id,
        sportId: m.sportId,
        scheduledAt: m.scheduledAt,
        result: m.result,
        memberCount: m.participants.length,
      })),
    };
  }

  // ──────────────────────────────────────────────────────────
  // Result recording
  // ──────────────────────────────────────────────────────────

  async recordResult(matchId: string, adminUserId: string, dto: RecordResultDto) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can record results');
    }
    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestException('Match already has a result');
    }

    const [result] = await this.prisma.$transaction([
      this.prisma.matchResult.create({
        data: { matchId, sets: dto.sets as object[], winnerTeam: dto.winnerTeam },
      }),
      this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.COMPLETED },
      }),
    ]);

    // Only notify stats for REGISTERED participants (guests are excluded)
    await this.notifyUsersServiceForStats(matchId, dto.winnerTeam, match.sportId);
    return result;
  }

  // ──────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────

  async changeParticipantTeam(matchId: string, participantId: string, adminUserId: string, team: Team | null) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can change participant teams');
    }

    const participant = await this.prisma.matchParticipant.findFirst({
      where: { id: participantId, matchId },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    return this.prisma.matchParticipant.update({
      where: { id: participantId },
      data: { team },
    });
  }

  private async assertSlotAvailable(matchId: string, maxPlayers: number) {
    const approvedCount = await this.prisma.matchParticipant.count({
      where: { matchId, status: ParticipantStatus.APPROVED },
    });
    if (approvedCount >= maxPlayers) {
      throw new BadRequestException('Match is full');
    }
  }

  private async syncMatchFullStatus(matchId: string, maxPlayers: number) {
    const approvedCount = await this.prisma.matchParticipant.count({
      where: { matchId, status: ParticipantStatus.APPROVED },
    });
    const newStatus = approvedCount >= maxPlayers ? MatchStatus.FULL : MatchStatus.OPEN;
    await this.prisma.match.update({ where: { id: matchId }, data: { status: newStatus } });
  }

  private async notifyUsersServiceForStats(
    matchId: string,
    winnerTeam: Team,
    sportId: string,
  ) {
    // Only REGISTERED participants get stats updates; GUEST participants are excluded
    const participants = await this.prisma.matchParticipant.findMany({
      where: {
        matchId,
        status: ParticipantStatus.APPROVED,
        participantType: ParticipantType.REGISTERED,
        userId: { not: null },
      },
    });

    const updates = participants.map((p) => {
      const won = p.team === winnerTeam;
      return firstValueFrom(
        this.http.post(`${this.usersServiceUrl}/api/v1/users/stats`, {
          userId: p.userId,
          sportId,
          won,
          pointsDelta: won ? 25 : -10,
        }),
      ).catch(() => null);
    });

    await Promise.allSettled(updates);
  }
}
