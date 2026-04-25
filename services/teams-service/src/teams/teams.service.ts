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
import { TeamMemberRole, TeamInviteStatus } from '@prisma/client';

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

  async create(adminUserId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        sportId: dto.sportId ?? null,
        color: dto.color ?? '#14B8A6',
        adminUserId,
        members: {
          create: { userId: adminUserId, role: TeamMemberRole.ADMIN },
        },
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
            members: { select: { userId: true, role: true, joinedAt: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({ ...m.team, myRole: m.role }));
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          select: { id: true, userId: true, role: true, joinedAt: true },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
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

  async update(id: string, adminUserId: string, dto: UpdateTeamDto) {
    await this.assertAdmin(id, adminUserId);
    return this.prisma.team.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name }), ...(dto.color && { color: dto.color }) },
    });
  }

  async disband(id: string, adminUserId: string) {
    await this.assertAdmin(id, adminUserId);
    // Cascade deletes members and invitations
    await this.prisma.team.delete({ where: { id } });
  }

  // ──────────────────────────────────────────────────────────
  // Invite flow
  // ──────────────────────────────────────────────────────────

  async inviteMember(teamId: string, adminUserId: string, dto: InviteMemberDto) {
    await this.assertAdmin(teamId, adminUserId);

    if (dto.userId === adminUserId) {
      throw new BadRequestException('Admin is already in the team');
    }

    const alreadyMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: dto.userId } },
    });
    if (alreadyMember) throw new ConflictException('User is already a team member');

    const alreadyInvited = await this.prisma.teamInvitation.findUnique({
      where: { teamId_invitedUserId: { teamId, invitedUserId: dto.userId } },
    });
    if (alreadyInvited?.status === TeamInviteStatus.PENDING) {
      throw new ConflictException('User already has a pending invitation');
    }

    // Upsert: re-invite if previously rejected
    return this.prisma.teamInvitation.upsert({
      where: { teamId_invitedUserId: { teamId, invitedUserId: dto.userId } },
      create: {
        teamId,
        invitedUserId: dto.userId,
        invitedByUserId: adminUserId,
        status: TeamInviteStatus.PENDING,
      },
      update: {
        invitedByUserId: adminUserId,
        status: TeamInviteStatus.PENDING,
        createdAt: new Date(),
      },
    });
  }

  async getPendingInvitations(teamId: string, adminUserId: string) {
    await this.assertAdmin(teamId, adminUserId);
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

    await this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: accept ? TeamInviteStatus.ACCEPTED : TeamInviteStatus.REJECTED },
    });

    if (accept) {
      await this.prisma.teamMember.create({
        data: { teamId: invitation.teamId, userId, role: TeamMemberRole.MEMBER },
      });
    }

    return { accepted: accept };
  }

  // ──────────────────────────────────────────────────────────
  // Member management
  // ──────────────────────────────────────────────────────────

  async removeMember(teamId: string, adminUserId: string, targetUserId: string) {
    await this.assertAdmin(teamId, adminUserId);

    if (targetUserId === adminUserId) {
      throw new BadRequestException('Admin cannot remove themselves — use disband to delete the team');
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
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
        note: 'Team needs at least 2 members to compute stats',
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

  private async assertAdmin(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member || member.role !== TeamMemberRole.ADMIN) {
      throw new ForbiddenException('Only the team admin can perform this action');
    }
  }
}
