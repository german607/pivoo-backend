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
import { randomUUID } from 'crypto';
import { CreateMatchDto } from './dto/create-match.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { RematchDto } from './dto/rematch.dto';
import { CreateMatchTemplateDto } from './dto/create-match-template.dto';
import { ChallengeMatchDto } from './dto/challenge-match.dto';
import { MatchStatus, ParticipantStatus, ParticipantType, Team } from '../generated/prisma';
import { MatchMode } from '../types/match.types';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

@Injectable()
export class MatchesService {
  private readonly usersServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
    private kafka: KafkaProducerService,
  ) {
    this.usersServiceUrl = this.config.get('USERS_SERVICE_URL') ?? 'http://users-service:3002';
  }

  // ──────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────

  async findMine(userId: string) {
    return this.prisma.match.findMany({
      where: {
        participants: {
          some: { userId, status: ParticipantStatus.APPROVED },
        },
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
        result: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findAll(filters: { sportId?: string; complexId?: string; status?: MatchStatus; country?: string; mode?: string }) {
    const now = new Date();
    const explicitStatus = filters.status;
    return this.prisma.match.findMany({
      where: {
        sportId: filters.sportId,
        complexId: filters.complexId,
        ...(filters.country && { country: filters.country }),
        ...(filters.mode && { mode: filters.mode as any }),
        status: explicitStatus ?? { in: [MatchStatus.OPEN, MatchStatus.FULL] },
        ...(explicitStatus == null && { scheduledAt: { gte: now } }),
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
    // Merge template fields if templateId provided
    if (dto.templateId) {
      const template = await this.prisma.matchTemplate.findFirst({
        where: { id: dto.templateId, userId: adminUserId },
      });
      if (!template) throw new NotFoundException('Template not found');
      dto = {
        sportId: dto.sportId ?? template.sportId,
        complexId: dto.complexId ?? template.complexId ?? undefined,
        complexName: dto.complexName ?? template.complexName ?? undefined,
        courtId: dto.courtId ?? template.courtId ?? undefined,
        maxPlayers: dto.maxPlayers ?? template.maxPlayers,
        minPlayers: dto.minPlayers ?? template.minPlayers,
        requiredLevel: dto.requiredLevel ?? template.requiredLevel ?? undefined,
        requiredCategory: dto.requiredCategory ?? (template.requiredCategory as any) ?? undefined,
        gender: dto.gender ?? (template.gender as any) ?? undefined,
        description: dto.description ?? template.description ?? undefined,
        scheduledAt: dto.scheduledAt,
        recurrence: dto.recurrence,
      };
    }

    const hasLevel = dto.requiredLevel !== undefined;
    const hasCategory = dto.requiredCategory !== undefined;
    if (!hasLevel && !hasCategory) {
      throw new BadRequestException('Debe indicar nivel o categoría');
    }
    if (hasLevel && hasCategory) {
      throw new BadRequestException('No puede indicar nivel y categoría al mismo tiempo');
    }

    const isTeamVsTeam = dto.mode === MatchMode.TEAM_VS_TEAM;
    if (isTeamVsTeam && dto.recurrence) {
      throw new BadRequestException('Los partidos en modo parejas no admiten recurrencia');
    }
    if (isTeamVsTeam && dto.partnerId === adminUserId) {
      throw new BadRequestException('El compañero debe ser un usuario distinto');
    }

    const country = await this.fetchUserCountry(adminUserId);
    const baseData = {
      sportId: dto.sportId,
      complexId: dto.complexId,
      complexName: dto.complexName,
      courtId: dto.courtId,
      maxPlayers: dto.maxPlayers,
      minPlayers: dto.minPlayers,
      requiredLevel: dto.requiredLevel,
      requiredCategory: dto.requiredCategory,
      gender: dto.gender,
      mode: dto.mode ?? MatchMode.INDIVIDUAL,
      description: dto.description,
      adminUserId,
      country,
    };

    if (!dto.recurrence) {
      const teamAParticipants: { userId: string; participantType: ParticipantType; status: ParticipantStatus; team: Team }[] = [
        { userId: adminUserId, participantType: ParticipantType.REGISTERED, status: ParticipantStatus.APPROVED, team: Team.TEAM_A },
        ...(isTeamVsTeam && dto.partnerId ? [
          { userId: dto.partnerId, participantType: ParticipantType.REGISTERED, status: ParticipantStatus.APPROVED, team: Team.TEAM_A },
        ] : []),
      ];

      const match = await this.prisma.match.create({
        data: {
          ...baseData,
          scheduledAt: new Date(dto.scheduledAt),
          participants: { create: teamAParticipants },
        },
        include: { participants: true },
      });

      if (isTeamVsTeam && dto.partnerId) {
        this.kafka.publishMatchPlayerInvited({
          matchId: match.id,
          invitedUserId: dto.partnerId,
          scheduledAt: dto.scheduledAt,
          sportId: dto.sportId,
        }).catch(() => null);
      }

      return match;
    }

    // Recurring: generate `count` instances linked by a shared recurrenceGroupId
    const groupId = randomUUID();
    const intervalDays = dto.recurrence.type === 'WEEKLY' ? 7 : 14;
    const base = new Date(dto.scheduledAt);

    const matches = await this.prisma.$transaction(
      Array.from({ length: dto.recurrence.count }, (_, i) => {
        const scheduledAt = new Date(base.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
        return this.prisma.match.create({
          data: {
            ...baseData,
            scheduledAt,
            recurrenceGroupId: groupId,
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
      }),
    );

    return { recurrenceGroupId: groupId, matches };
  }

  private async fetchUserCountry(userId: string): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(`${this.usersServiceUrl}/api/v1/users/${userId}`),
      );
      return (res.data?.country as string | null) ?? null;
    } catch {
      return null;
    }
  }

  async expirePastMatches() {
    const now = new Date();
    const toExpire = await this.prisma.match.findMany({
      where: { scheduledAt: { lt: now }, status: { in: [MatchStatus.OPEN, MatchStatus.FULL] } },
      include: {
        participants: {
          where: { status: ParticipantStatus.APPROVED, participantType: ParticipantType.REGISTERED, userId: { not: null } },
          select: { userId: true },
        },
        _count: { select: { participants: { where: { status: ParticipantStatus.APPROVED } } } },
      },
    });

    if (toExpire.length === 0) return { closed: 0 };

    await this.prisma.match.updateMany({
      where: { id: { in: toExpire.map((m) => m.id) } },
      data: { status: MatchStatus.CANCELLED },
    });

    for (const match of toExpire) {
      const participantUserIds = match.participants.map((p) => p.userId as string);
      if (participantUserIds.length === 0) continue;
      this.kafka.publishMatchCancelled({
        matchId: match.id,
        participantUserIds,
        scheduledAt: match.scheduledAt.toISOString(),
        sportId: match.sportId,
      }).catch(() => null);
    }

    return { closed: toExpire.length };
  }

  async cancelMatch(matchId: string, adminUserId: string) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can cancel');
    }
    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match cannot be cancelled');
    }
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED },
    });

    const participantUserIds = match.participants
      .filter((p) => p.status === ParticipantStatus.APPROVED && p.userId && p.userId !== adminUserId)
      .map((p) => p.userId as string);
    this.kafka.publishMatchCancelled({
      matchId,
      participantUserIds,
      scheduledAt: match.scheduledAt.toISOString(),
      sportId: match.sportId,
    }).catch(() => null);

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // Registered user — request to join
  // ──────────────────────────────────────────────────────────

  async requestToJoin(matchId: string, userId: string) {
    const match = await this.findOne(matchId);

    if (match.status !== MatchStatus.OPEN && match.status !== MatchStatus.FULL) {
      throw new BadRequestException('Match is not accepting requests');
    }
    if (match.adminUserId === userId) {
      throw new BadRequestException('Admin is already in the match');
    }

    const existing = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId },
    });
    if (existing) throw new ConflictException('Already requested or in waitlist for this match');

    const isWaitlist = match.status === MatchStatus.FULL;
    const participant = await this.prisma.matchParticipant.create({
      data: {
        matchId,
        userId,
        participantType: ParticipantType.REGISTERED,
        status: isWaitlist ? ParticipantStatus.WAITLISTED : ParticipantStatus.PENDING,
      },
    });

    if (!isWaitlist) {
      this.kafka.publishMatchJoinRequested({
        matchId,
        adminUserId: match.adminUserId,
        requestingUserId: userId,
        scheduledAt: match.scheduledAt.toISOString(),
        sportId: match.sportId,
      }).catch(() => null);
    }

    return { ...participant, waitlisted: isWaitlist };
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
      this.kafka.publishMatchJoinApproved({
        matchId,
        userId: participantUserId,
        scheduledAt: match.scheduledAt.toISOString(),
        sportId: match.sportId,
      }).catch(() => null);
    } else {
      this.kafka.publishMatchJoinRejected({
        matchId,
        userId: participantUserId,
        sportId: match.sportId,
      }).catch(() => null);
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

    const record = await this.prisma.matchParticipant.create({
      data: {
        matchId,
        userId: dto.userId,
        participantType: ParticipantType.REGISTERED,
        status: ParticipantStatus.INVITED,
        team: dto.team ?? null,
      },
    });

    this.kafka.publishMatchPlayerInvited({
      matchId,
      invitedUserId: dto.userId,
      scheduledAt: match.scheduledAt.toISOString(),
      sportId: match.sportId,
    }).catch(() => null);

    return record;
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

    if (match.status === MatchStatus.FULL && participant.status === ParticipantStatus.APPROVED) {
      await this.promoteFromWaitlist(matchId, match.maxPlayers, match.scheduledAt.toISOString(), match.sportId);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Leave match (participant leaves voluntarily)
  // ──────────────────────────────────────────────────────────

  async leaveMatch(matchId: string, userId: string) {
    const match = await this.findOne(matchId);

    if (match.adminUserId === userId) {
      throw new BadRequestException('The match admin cannot leave the match. Cancel it instead.');
    }

    if (match.status === MatchStatus.IN_PROGRESS || match.status === MatchStatus.COMPLETED) {
      throw new BadRequestException('Cannot leave a match that is already in progress or completed');
    }

    const participant = await this.prisma.matchParticipant.findFirst({
      where: { matchId, userId, participantType: 'REGISTERED' },
    });
    if (!participant) throw new NotFoundException('You are not a participant in this match');

    await this.prisma.matchParticipant.delete({ where: { id: participant.id } });

    if (match.status === MatchStatus.FULL && participant.status === ParticipantStatus.APPROVED) {
      await this.promoteFromWaitlist(matchId, match.maxPlayers, match.scheduledAt.toISOString(), match.sportId);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Team vs Team — challenge flow
  // ──────────────────────────────────────────────────────────

  async challengeMatch(matchId: string, challengerId: string, dto: ChallengeMatchDto) {
    const match = await this.findOne(matchId);

    if ((match as any).mode !== MatchMode.TEAM_VS_TEAM) {
      throw new BadRequestException('Este partido no admite desafíos de equipo');
    }
    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('El partido no está abierto para desafíos');
    }
    if (match.adminUserId === challengerId) {
      throw new BadRequestException('El administrador del partido no puede desafiar su propio partido');
    }
    if (dto.partnerId === challengerId) {
      throw new BadRequestException('El compañero debe ser un usuario distinto');
    }

    const teamBActive = match.participants.filter(
      (p) => p.team === Team.TEAM_B && (p.status === ParticipantStatus.PENDING || p.status === ParticipantStatus.APPROVED),
    );
    if (teamBActive.length > 0) {
      throw new ConflictException('El equipo B ya tiene un desafío pendiente o aprobado');
    }

    const alreadyIn = match.participants.filter(
      (p) => p.userId === challengerId || p.userId === dto.partnerId,
    );
    if (alreadyIn.length > 0) {
      throw new ConflictException('Uno de los jugadores ya participa en este partido');
    }

    await this.prisma.$transaction([
      this.prisma.matchParticipant.create({
        data: { matchId, userId: challengerId, participantType: ParticipantType.REGISTERED, status: ParticipantStatus.PENDING, team: Team.TEAM_B },
      }),
      this.prisma.matchParticipant.create({
        data: { matchId, userId: dto.partnerId, participantType: ParticipantType.REGISTERED, status: ParticipantStatus.PENDING, team: Team.TEAM_B },
      }),
    ]);

    this.kafka.publishMatchJoinRequested({
      matchId,
      adminUserId: match.adminUserId,
      requestingUserId: challengerId,
      scheduledAt: match.scheduledAt.toISOString(),
      sportId: match.sportId,
    }).catch(() => null);

    return { challenged: true };
  }

  async approveChallenge(matchId: string, adminUserId: string) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Solo el administrador puede aprobar el desafío');
    }
    if ((match as any).mode !== MatchMode.TEAM_VS_TEAM) {
      throw new BadRequestException('Solo disponible para partidos en modo parejas');
    }

    const pendingTeamB = match.participants.filter(
      (p) => p.team === Team.TEAM_B && p.status === ParticipantStatus.PENDING,
    );
    if (pendingTeamB.length === 0) {
      throw new NotFoundException('No hay desafío pendiente para aprobar');
    }

    for (const p of pendingTeamB) {
      await this.assertSlotAvailable(matchId, match.maxPlayers);
      await this.prisma.matchParticipant.update({
        where: { id: p.id },
        data: { status: ParticipantStatus.APPROVED },
      });
      if (p.userId) {
        this.kafka.publishMatchJoinApproved({
          matchId,
          userId: p.userId,
          scheduledAt: match.scheduledAt.toISOString(),
          sportId: match.sportId,
        }).catch(() => null);
      }
    }

    await this.syncMatchFullStatus(matchId, match.maxPlayers);
    return { approved: true };
  }

  async rejectChallenge(matchId: string, adminUserId: string) {
    const match = await this.findOne(matchId);
    if (match.adminUserId !== adminUserId) {
      throw new ForbiddenException('Solo el administrador puede rechazar el desafío');
    }

    const pendingTeamB = match.participants.filter(
      (p) => p.team === Team.TEAM_B && p.status === ParticipantStatus.PENDING,
    );
    if (pendingTeamB.length === 0) {
      throw new NotFoundException('No hay desafío pendiente para rechazar');
    }

    for (const p of pendingTeamB) {
      await this.prisma.matchParticipant.update({
        where: { id: p.id },
        data: { status: ParticipantStatus.REJECTED },
      });
      if (p.userId) {
        this.kafka.publishMatchJoinRejected({
          matchId,
          userId: p.userId,
          sportId: match.sportId,
        }).catch(() => null);
      }
    }

    return { rejected: true };
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

    await this.notifyUsersServiceForStats(matchId, dto.winnerTeam, match.sportId);

    const participants = await this.prisma.matchParticipant.findMany({
      where: { matchId, status: ParticipantStatus.APPROVED, participantType: ParticipantType.REGISTERED, userId: { not: null } },
      select: { userId: true },
    });
    this.kafka.publishMatchResultRecorded({
      matchId,
      participantUserIds: participants.map((p) => p.userId as string),
      winnerTeam: dto.winnerTeam,
      sportId: match.sportId,
    }).catch(() => null);

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

  // ──────────────────────────────────────────────────────────
  // #11 — Waitlist promotion
  // ──────────────────────────────────────────────────────────

  private async promoteFromWaitlist(matchId: string, maxPlayers: number, scheduledAt: string, sportId: string) {
    const next = await this.prisma.matchParticipant.findFirst({
      where: { matchId, status: ParticipantStatus.WAITLISTED },
      orderBy: { joinedAt: 'asc' },
    });

    if (!next) {
      await this.prisma.match.update({ where: { id: matchId }, data: { status: MatchStatus.OPEN } });
      return;
    }

    await this.prisma.matchParticipant.update({
      where: { id: next.id },
      data: { status: ParticipantStatus.APPROVED },
    });

    await this.syncMatchFullStatus(matchId, maxPlayers);

    this.kafka.publishMatchWaitlistPromoted({
      matchId,
      userId: next.userId as string,
      scheduledAt,
      sportId,
    }).catch(() => null);
  }

  // ──────────────────────────────────────────────────────────
  // #14 — Rematch
  // ──────────────────────────────────────────────────────────

  async rematch(matchId: string, adminUserId: string, dto: RematchDto) {
    const original = await this.findOne(matchId);
    if (original.adminUserId !== adminUserId) {
      throw new ForbiddenException('Only the match admin can create a rematch');
    }
    if (original.status !== MatchStatus.COMPLETED && original.status !== MatchStatus.CANCELLED) {
      throw new BadRequestException('Rematch is only available for completed or cancelled matches');
    }

    const newMatch = await this.prisma.match.create({
      data: {
        sportId: original.sportId,
        complexId: original.complexId ?? undefined,
        complexName: original.complexName ?? undefined,
        courtId: original.courtId ?? undefined,
        adminUserId,
        scheduledAt: new Date(dto.scheduledAt),
        maxPlayers: original.maxPlayers,
        minPlayers: original.minPlayers,
        requiredLevel: original.requiredLevel ?? undefined,
        requiredCategory: original.requiredCategory ?? undefined,
        gender: original.gender ?? undefined,
        description: original.description ?? undefined,
        country: original.country ?? undefined,
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

    // Invite all previously approved participants (except the admin)
    const previousPlayers = original.participants.filter(
      (p) => p.status === ParticipantStatus.APPROVED &&
             p.participantType === ParticipantType.REGISTERED &&
             p.userId && p.userId !== adminUserId,
    );

    for (const p of previousPlayers) {
      await this.prisma.matchParticipant.create({
        data: {
          matchId: newMatch.id,
          userId: p.userId,
          participantType: ParticipantType.REGISTERED,
          status: ParticipantStatus.INVITED,
          team: p.team ?? undefined,
        },
      });
      this.kafka.publishMatchPlayerInvited({
        matchId: newMatch.id,
        invitedUserId: p.userId as string,
        scheduledAt: dto.scheduledAt,
        sportId: original.sportId,
      }).catch(() => null);
    }

    return newMatch;
  }

  // ──────────────────────────────────────────────────────────
  // #15 — Match templates
  // ──────────────────────────────────────────────────────────

  async createTemplate(userId: string, dto: CreateMatchTemplateDto) {
    const hasLevel = dto.requiredLevel !== undefined;
    const hasCategory = dto.requiredCategory !== undefined;
    if (!hasLevel && !hasCategory) throw new BadRequestException('Debe indicar nivel o categoría');
    if (hasLevel && hasCategory) throw new BadRequestException('No puede indicar nivel y categoría al mismo tiempo');

    return this.prisma.matchTemplate.create({
      data: { ...dto, userId },
    });
  }

  async findMyTemplates(userId: string) {
    return this.prisma.matchTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: string, userId: string) {
    const template = await this.prisma.matchTemplate.findFirst({ where: { id, userId } });
    if (!template) throw new NotFoundException('Template not found');
    await this.prisma.matchTemplate.delete({ where: { id } });
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
