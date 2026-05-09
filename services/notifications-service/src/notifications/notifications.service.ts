import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationType } from '../generated/prisma';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdatePreferenceDto } from './dto/update-preferences.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import {
  MatchPlayerInvitedEvent,
  MatchJoinApprovedEvent,
  MatchJoinRejectedEvent,
  MatchCancelledEvent,
  MatchResultRecordedEvent,
  TournamentRegistrationApprovedEvent,
  TournamentRegistrationRejectedEvent,
  TournamentBracketGeneratedEvent,
  TournamentFinalizedEvent,
} from '../kafka/events';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // ─── REST handlers ───────────────────────────────────────────

  async findAll(userId: string, dto: QueryNotificationsDto) {
    const { unreadOnly, limit = 20, offset = 0 } = dto;
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  // ─── Preferences ─────────────────────────────────────────────

  async getPreferences(userId: string) {
    const allTypes = Object.values(NotificationType);
    const saved = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const savedMap = new Map(saved.map((p) => [p.type, p.enabled]));
    return allTypes.map((type) => ({ type, enabled: savedMap.get(type) ?? true }));
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type: dto.type } },
      update: { enabled: dto.enabled },
      create: { userId, type: dto.type, enabled: dto.enabled },
    });
  }

  // ─── Device tokens ───────────────────────────────────────────

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform },
      create: { userId, token: dto.token, platform: dto.platform },
    });
  }

  async removeDeviceToken(token: string, userId: string) {
    const existing = await this.prisma.deviceToken.findFirst({ where: { token, userId } });
    if (!existing) throw new NotFoundException('Device token not found');
    await this.prisma.deviceToken.delete({ where: { token } });
  }

  // ─── Event handlers ──────────────────────────────────────────

  async handleMatchPlayerInvited(event: MatchPlayerInvitedEvent) {
    const date = new Date(event.scheduledAt).toLocaleDateString('es-AR', { dateStyle: 'medium' });
    await this.notify({
      userId: event.invitedUserId,
      type: NotificationType.MATCH_INVITATION,
      title: 'Te invitaron a un partido',
      body: `Fuiste invitado a un partido el ${date}`,
      data: { matchId: event.matchId, sportId: event.sportId },
    });
  }

  async handleMatchJoinApproved(event: MatchJoinApprovedEvent) {
    const date = new Date(event.scheduledAt).toLocaleDateString('es-AR', { dateStyle: 'medium' });
    await this.notify({
      userId: event.userId,
      type: NotificationType.MATCH_JOIN_APPROVED,
      title: 'Solicitud aprobada',
      body: `Tu solicitud para el partido del ${date} fue aprobada`,
      data: { matchId: event.matchId, sportId: event.sportId },
    });
  }

  async handleMatchJoinRejected(event: MatchJoinRejectedEvent) {
    await this.notify({
      userId: event.userId,
      type: NotificationType.MATCH_JOIN_REJECTED,
      title: 'Solicitud rechazada',
      body: 'Tu solicitud para unirte al partido fue rechazada',
      data: { matchId: event.matchId, sportId: event.sportId },
    });
  }

  async handleMatchCancelled(event: MatchCancelledEvent) {
    const date = new Date(event.scheduledAt).toLocaleDateString('es-AR', { dateStyle: 'medium' });
    await this.notifyMany({
      userIds: event.participantUserIds,
      type: NotificationType.MATCH_CANCELLED,
      title: 'Partido cancelado',
      body: `El partido del ${date} fue cancelado`,
      data: { matchId: event.matchId, sportId: event.sportId },
    });
  }

  async handleMatchResultRecorded(event: MatchResultRecordedEvent) {
    await this.notifyMany({
      userIds: event.participantUserIds,
      type: NotificationType.MATCH_RESULT_RECORDED,
      title: 'Resultado registrado',
      body: 'El resultado de tu partido fue registrado. ¡Revisá tus estadísticas!',
      data: { matchId: event.matchId, sportId: event.sportId, winnerTeam: event.winnerTeam },
    });
  }

  async handleTournamentRegistrationApproved(event: TournamentRegistrationApprovedEvent) {
    await this.notify({
      userId: event.userId,
      type: NotificationType.TOURNAMENT_REGISTRATION_APPROVED,
      title: 'Inscripción aprobada',
      body: `Tu inscripción al torneo "${event.tournamentName}" fue aprobada`,
      data: { tournamentId: event.tournamentId },
    });
  }

  async handleTournamentRegistrationRejected(event: TournamentRegistrationRejectedEvent) {
    await this.notify({
      userId: event.userId,
      type: NotificationType.TOURNAMENT_REGISTRATION_REJECTED,
      title: 'Inscripción rechazada',
      body: `Tu inscripción al torneo "${event.tournamentName}" fue rechazada`,
      data: { tournamentId: event.tournamentId },
    });
  }

  async handleTournamentBracketGenerated(event: TournamentBracketGeneratedEvent) {
    await this.notifyMany({
      userIds: event.participantUserIds,
      type: NotificationType.TOURNAMENT_BRACKET_GENERATED,
      title: 'Bracket generado',
      body: `El bracket del torneo "${event.tournamentName}" ya está disponible`,
      data: { tournamentId: event.tournamentId },
    });
  }

  async handleTournamentFinalized(event: TournamentFinalizedEvent) {
    await this.notifyMany({
      userIds: event.participantUserIds,
      type: NotificationType.TOURNAMENT_FINALIZED,
      title: 'Torneo finalizado',
      body: `El torneo "${event.tournamentName}" finalizó. ¡Revisá los resultados!`,
      data: {
        tournamentId: event.tournamentId,
        ...(event.winnerId ? { winnerId: event.winnerId } : {}),
      },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────

  private async notify(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const isEnabled = await this.isPreferenceEnabled(params.userId, params.type);
    if (!isEnabled) return;

    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      },
    });

    await this.sendPush(params.userId, params.title, params.body, params.data);
  }

  private async notifyMany(params: {
    userIds: string[];
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    if (params.userIds.length === 0) return;

    const enabledPrefs = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: params.userIds }, type: params.type, enabled: false },
      select: { userId: true },
    });
    const optedOut = new Set(enabledPrefs.map((p) => p.userId));
    const targets = params.userIds.filter((id) => !optedOut.has(id));

    if (targets.length === 0) return;

    await this.prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      })),
    });

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: targets } },
      select: { token: true },
    });
    await this.push.sendToTokens(
      tokens.map((t) => t.token),
      params.title,
      params.body,
      params.data,
    );
  }

  private async isPreferenceEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    return pref?.enabled ?? true;
  }

  private async sendPush(userId: string, title: string, body: string, data?: Record<string, string>) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return;
    await this.push.sendToTokens(tokens.map((t) => t.token), title, body, data);
  }
}
