import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { TeamInviteStatus } from '../generated/prisma';

const MAX_MEMBERS = 2;

@Injectable()
export class TeamsService {
  private readonly matchesServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.matchesServiceUrl =
      this.config.get('MATCHES_SERVICE_URL') ?? 'http://matches-service:3003';
  }

  // ──────────────────────────────────────────────────────────
  // Team CRUD
  // ──────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        sportId: dto.sportId ?? null,
        color: dto.color ?? '#14B8A6',
        members: { create: { userId } },
      },
      include: { members: true },
    });
  }

  async getMyTeams(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            members: { select: { userId: true, joinedAt: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => m.team);
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          select: { id: true, userId: true, joinedAt: true },
          orderBy: { joinedAt: 'asc' },
        },
        invitations: {
          where: { status: TeamInviteStatus.PENDING },
          select: { id: true, invitedUserId: true, invitedByUserId: true, createdAt: true },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async update(id: string, userId: string, dto: UpdateTeamDto) {
    await this.assertMember(id, userId);
    return this.prisma.team.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name }), ...(dto.color && { color: dto.color }) },
    });
  }

  async disband(id: string, userId: string) {
    await this.assertMember(id, userId);
    await this.prisma.team.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────────────────
  // Invite flow
  // ──────────────────────────────────────────────────────────

  async inviteMember(teamId: string, userId: string, dto: InviteMemberDto) {
    await this.assertMember(teamId, userId);

    if (dto.userId === userId) {
      throw new BadRequestException('You are already in the team');
    }

    const [memberCount, pendingCount] = await Promise.all([
      this.prisma.teamMember.count({ where: { teamId } }),
      this.prisma.teamInvitation.count({
        where: { teamId, status: TeamInviteStatus.PENDING },
      }),
    ]);

    if (memberCount + pendingCount >= MAX_MEMBERS) {
      throw new BadRequestException(
        `Team is full — max ${MAX_MEMBERS} members allowed`,
      );
    }

    const alreadyMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: dto.userId } },
    });
    if (alreadyMember) throw new ConflictException('User is already a team member');

    const existing = await this.prisma.teamInvitation.findUnique({
      where: { teamId_invitedUserId: { teamId, invitedUserId: dto.userId } },
    });
    if (existing?.status === TeamInviteStatus.PENDING) {
      throw new ConflictException('User already has a pending invitation');
    }

    return this.prisma.teamInvitation.upsert({
      where: { teamId_invitedUserId: { teamId, invitedUserId: dto.userId } },
      create: { teamId, invitedUserId: dto.userId, invitedByUserId: userId },
      update: { invitedByUserId: userId, status: TeamInviteStatus.PENDING, createdAt: new Date() },
    });
  }

  async getPendingInvitations(teamId: string, userId: string) {
    await this.assertMember(teamId, userId);
    return this.prisma.teamInvitation.findMany({
      where: { teamId, status: TeamInviteStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyInvitations(userId: string) {
    return this.prisma.teamInvitation.findMany({
      where: { invitedUserId: userId, status: TeamInviteStatus.PENDING },
      include: {
        team: { select: { id: true, name: true, color: true, sportId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respondToInvitation(invitationId: string, userId: string, accept: boolean) {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.invitedUserId !== userId) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== TeamInviteStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (accept) {
      const memberCount = await this.prisma.teamMember.count({
        where: { teamId: invitation.teamId },
      });
      if (memberCount >= MAX_MEMBERS) {
        // Cancel the invite since the team filled up while this was pending
        await this.prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: TeamInviteStatus.REJECTED },
        });
        throw new BadRequestException('Team is already full');
      }

      await this.prisma.$transaction([
        this.prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: TeamInviteStatus.ACCEPTED },
        }),
        this.prisma.teamMember.create({
          data: { teamId: invitation.teamId, userId },
        }),
      ]);
    } else {
      await this.prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: TeamInviteStatus.REJECTED },
      });
    }

    return { accepted: accept };
  }

  // ──────────────────────────────────────────────────────────
  // Member management
  // ──────────────────────────────────────────────────────────

  async removeMember(teamId: string, requesterId: string, targetUserId: string) {
    await this.assertMember(teamId, requesterId);

    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });

    // Auto-disband if the last member left
    const remaining = await this.prisma.teamMember.count({ where: { teamId } });
    if (remaining === 0) {
      await this.prisma.team.delete({ where: { id: teamId } });
    }
  }

  // ──────────────────────────────────────────────────────────
  // Stats (fetched from matches-service)
  // ──────────────────────────────────────────────────────────

  async getTeamStats(teamId: string, sportId?: string) {
    const team = await this.findOne(teamId);

    const userIds = team.members.map((m) => m.userId);
    if (userIds.length < 2) {
      return {
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        winRate: 0,
        recentMatches: [],
        note: 'Team needs 2 members to compute stats',
      };
    }

    const effectiveSportId = sportId ?? team.sportId ?? undefined;
    const params = new URLSearchParams({ userIds: userIds.join(',') });
    if (effectiveSportId) params.set('sportId', effectiveSportId);

    const { data } = await firstValueFrom(
      this.http.get(
        `${this.matchesServiceUrl}/api/v1/matches/team-stats?${params.toString()}`,
      ),
    );

    return { ...data, teamName: team.name, memberCount: userIds.length };
  }

  // ──────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────

  private async assertMember(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }
  }
}
