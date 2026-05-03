import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  TournamentStatus,
  TournamentFormat,
  RegistrationStatus,
  TournamentMatchStatus,
} from '../generated/prisma';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RecordMatchScoreDto } from './dto/record-match-score.dto';
import { SetRankingPointsDto } from './dto/set-ranking-points.dto';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { AssignPlayersDto } from './dto/assign-players.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  // ─── Queries ────────────────────────────────────────────────

  findAll(filters: { complexId?: string; sportId?: string; status?: TournamentStatus }) {
    return this.prisma.tournament.findMany({
      where: {
        complexId: filters.complexId,
        sportId: filters.sportId,
        status: filters.status,
      },
      include: {
        complex: { select: { name: true, city: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        complex: { select: { name: true, city: true } },
        registrations: { orderBy: { seed: 'asc' } },
        matches: { orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }] },
        rankingPoints: { orderBy: { position: 'asc' } },
        results: { orderBy: { position: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('Tournament not found');
    return t;
  }

  // ─── Tournament lifecycle ────────────────────────────────────

  create(complexId: string, dto: CreateTournamentDto) {
    const hasLevel = dto.level !== undefined;
    const hasCategory = dto.category !== undefined;
    if (!hasLevel && !hasCategory) {
      throw new BadRequestException('Debe indicar nivel o categoría');
    }
    if (hasLevel && hasCategory) {
      throw new BadRequestException('No puede indicar nivel y categoría al mismo tiempo');
    }

    const { startDate, registrationDeadline, ...rest } = dto;
    return this.prisma.tournament.create({
      data: {
        ...rest,
        complexId,
        startDate: new Date(startDate),
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      },
    });
  }

  async openRegistration(tournamentId: string, complexId: string) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    if (t.status !== TournamentStatus.DRAFT) {
      throw new BadRequestException('Tournament must be in DRAFT to open registration');
    }
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.REGISTRATION_OPEN },
    });
  }

  async cancel(tournamentId: string, complexId: string) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    if (t.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed tournament');
    }
    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: TournamentStatus.CANCELLED },
    });
  }

  // ─── Registrations ──────────────────────────────────────────

  async register(tournamentId: string, userId: string) {
    const t = await this.findOne(tournamentId);
    if (t.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Tournament is not open for registration');
    }
    const approvedCount = t.registrations.filter(
      (r) => r.status === RegistrationStatus.APPROVED,
    ).length;
    if (approvedCount >= t.maxParticipants) {
      throw new BadRequestException('Tournament is full');
    }
    const existing = t.registrations.find((r) => r.userId === userId);
    if (existing) throw new ConflictException('Already registered');

    return this.prisma.tournamentRegistration.create({
      data: { tournamentId, userId },
    });
  }

  async approveRegistration(tournamentId: string, userId: string, complexId: string, seed?: number) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const reg = t.registrations.find((r) => r.userId === userId);
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.status !== RegistrationStatus.PENDING) {
      throw new BadRequestException('Registration is not pending');
    }
    return this.prisma.tournamentRegistration.update({
      where: { tournamentId_userId: { tournamentId, userId } },
      data: { status: RegistrationStatus.APPROVED, seed: seed ?? null },
    });
  }

  async rejectRegistration(tournamentId: string, userId: string, complexId: string) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const reg = t.registrations.find((r) => r.userId === userId);
    if (!reg) throw new NotFoundException('Registration not found');
    return this.prisma.tournamentRegistration.update({
      where: { tournamentId_userId: { tournamentId, userId } },
      data: { status: RegistrationStatus.REJECTED },
    });
  }

  async withdraw(tournamentId: string, userId: string) {
    const t = await this.findOne(tournamentId);
    if (t.status === TournamentStatus.IN_PROGRESS || t.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Cannot withdraw from an in-progress or completed tournament');
    }
    const reg = t.registrations.find((r) => r.userId === userId);
    if (!reg) throw new NotFoundException('Registration not found');
    return this.prisma.tournamentRegistration.update({
      where: { tournamentId_userId: { tournamentId, userId } },
      data: { status: RegistrationStatus.WITHDRAWN },
    });
  }

  // ─── Bracket generation ──────────────────────────────────────

  async generateBracket(tournamentId: string, complexId: string) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    if (t.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Tournament must be in REGISTRATION_OPEN to generate bracket');
    }
    if (t.matches.length > 0) {
      throw new ConflictException('Bracket already generated');
    }

    const approved = t.registrations
      .filter((r) => r.status === RegistrationStatus.APPROVED)
      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

    if (approved.length < 2) {
      throw new BadRequestException('Need at least 2 approved participants');
    }

    const matchData = t.format === TournamentFormat.SINGLE_ELIMINATION
      ? this.buildSingleEliminationBracket(approved.map((r) => r.userId), tournamentId)
      : this.buildRoundRobinBracket(approved.map((r) => r.userId), tournamentId);

    await this.prisma.$transaction([
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      }),
      this.prisma.tournamentMatch.createMany({ data: matchData }),
    ]);

    return this.findOne(tournamentId);
  }

  // ─── Match management ────────────────────────────────────────

  async scheduleMatch(
    tournamentId: string,
    matchId: string,
    complexId: string,
    dto: ScheduleMatchDto,
  ) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const match = t.matches.find((m) => m.id === matchId);
    if (!match) throw new NotFoundException('Match not found');

    return this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        courtId: dto.courtId ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: TournamentMatchStatus.IN_PROGRESS,
      },
    });
  }

  async recordScore(
    tournamentId: string,
    matchId: string,
    complexId: string,
    dto: RecordMatchScoreDto,
  ) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const match = t.matches.find((m) => m.id === matchId);
    if (!match) throw new NotFoundException('Match not found');
    if (!match.player1Id || !match.player2Id) {
      throw new BadRequestException('Match does not have two players yet');
    }
    if (dto.winnerId !== match.player1Id && dto.winnerId !== match.player2Id) {
      throw new BadRequestException('Winner must be one of the two players');
    }

    const previousWinnerId = match.winnerId;

    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        sets: dto.sets as object[],
        winnerId: dto.winnerId,
        status: TournamentMatchStatus.COMPLETED,
        completedAt: match.completedAt ?? new Date(),
      },
    });

    if (t.format === TournamentFormat.SINGLE_ELIMINATION) {
      if (previousWinnerId && previousWinnerId !== dto.winnerId) {
        // Winner changed — swap them in the next-round slot before re-advancing
        await this.retractWinner(tournamentId, match.round, match.matchNumber, previousWinnerId);
      }
      await this.advanceWinner(tournamentId, match.round, match.matchNumber, dto.winnerId);
    }

    return this.findOne(tournamentId);
  }

  // ─── Manual match management ─────────────────────────────────

  async assignPlayers(
    tournamentId: string,
    matchId: string,
    complexId: string,
    dto: AssignPlayersDto,
  ) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const match = t.matches.find((m) => m.id === matchId);
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === TournamentMatchStatus.COMPLETED) {
      throw new BadRequestException('Cannot move players in a completed match — update its score instead');
    }

    const approvedIds = new Set(
      t.registrations
        .filter((r) => r.status === RegistrationStatus.APPROVED)
        .map((r) => r.userId),
    );
    if (dto.player1Id && !approvedIds.has(dto.player1Id)) {
      throw new BadRequestException('player1Id must be an approved participant');
    }
    if (dto.player2Id && !approvedIds.has(dto.player2Id)) {
      throw new BadRequestException('player2Id must be an approved participant');
    }

    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        ...(dto.player1Id !== undefined && { player1Id: dto.player1Id ?? null }),
        ...(dto.player2Id !== undefined && { player2Id: dto.player2Id ?? null }),
        winnerId: null,
        sets: Prisma.JsonNull,
        completedAt: null,
      },
    });
    return this.findOne(tournamentId);
  }

  async createMatch(tournamentId: string, complexId: string, dto: CreateMatchDto) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);

    const conflict = t.matches.find(
      (m) => m.round === dto.round && m.matchNumber === dto.matchNumber,
    );
    if (conflict) {
      throw new ConflictException(
        `Match already exists at round ${dto.round}, match ${dto.matchNumber}`,
      );
    }

    return this.prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: dto.round,
        matchNumber: dto.matchNumber,
        player1Id: dto.player1Id ?? null,
        player2Id: dto.player2Id ?? null,
        courtId: dto.courtId ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.status ?? TournamentMatchStatus.PENDING,
      },
    });
  }

  async updateMatch(
    tournamentId: string,
    matchId: string,
    complexId: string,
    dto: UpdateMatchDto,
  ) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const match = t.matches.find((m) => m.id === matchId);
    if (!match) throw new NotFoundException('Match not found');

    if (dto.round !== undefined || dto.matchNumber !== undefined) {
      const newRound = dto.round ?? match.round;
      const newNumber = dto.matchNumber ?? match.matchNumber;
      const conflict = t.matches.find(
        (m) => m.id !== matchId && m.round === newRound && m.matchNumber === newNumber,
      );
      if (conflict) {
        throw new ConflictException(
          `Another match already occupies round ${newRound}, match ${newNumber}`,
        );
      }
    }

    return this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        ...(dto.round !== undefined && { round: dto.round }),
        ...(dto.matchNumber !== undefined && { matchNumber: dto.matchNumber }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.courtId !== undefined && { courtId: dto.courtId }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: new Date(dto.scheduledAt) }),
      },
    });
  }

  async deleteMatch(tournamentId: string, matchId: string, complexId: string) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    const match = t.matches.find((m) => m.id === matchId);
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === TournamentMatchStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete a completed match — update its score instead');
    }
    await this.prisma.tournamentMatch.delete({ where: { id: matchId } });
  }


  // ─── Ranking points config ───────────────────────────────────

  async setRankingPoints(tournamentId: string, complexId: string, dto: SetRankingPointsDto) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);

    await this.prisma.tournamentRankingPoint.deleteMany({ where: { tournamentId } });
    await this.prisma.tournamentRankingPoint.createMany({
      data: dto.points.map(({ position, points }) => ({ tournamentId, position, points })),
    });

    return this.prisma.tournamentRankingPoint.findMany({
      where: { tournamentId },
      orderBy: { position: 'asc' },
    });
  }

  // ─── Finalize & results ──────────────────────────────────────

  async finalize(tournamentId: string, complexId: string) {
    const t = await this.findOne(tournamentId);
    this.assertOwner(t, complexId);
    if (t.status !== TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Tournament must be IN_PROGRESS to finalize');
    }

    const pending = t.matches.filter(
      (m) => m.status !== TournamentMatchStatus.COMPLETED && m.status !== TournamentMatchStatus.BYE,
    );
    if (pending.length > 0) {
      throw new BadRequestException(`${pending.length} match(es) still pending`);
    }

    const standings = this.computeStandings(t.matches, t.format);
    const pointsMap = new Map(t.rankingPoints.map((r) => [r.position, r.points]));

    const results = standings.map(({ userId, position }) => ({
      tournamentId,
      userId,
      position,
      points: pointsMap.get(position) ?? 0,
    }));

    await this.prisma.$transaction([
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.COMPLETED },
      }),
      this.prisma.tournamentResult.createMany({ data: results, skipDuplicates: true }),
    ]);

    return this.findOne(tournamentId);
  }

  // ─── Private helpers ─────────────────────────────────────────

  private assertOwner(tournament: { complexId: string }, complexId: string) {
    if (tournament.complexId !== complexId) {
      throw new ForbiddenException('You do not manage this tournament');
    }
  }

  private buildSingleEliminationBracket(
    playerIds: string[],
    tournamentId: string,
  ) {
    const n = playerIds.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
    // Pad with null (BYE) to reach next power of 2
    const padded: (string | null)[] = [...playerIds];
    while (padded.length < bracketSize) padded.push(null);

    // Standard seeding: 1v(n), 2v(n-1), ...
    const seeds = this.buildSeedPairs(bracketSize);
    const round1Matches = seeds.map(([s1, s2], i) => {
      const p1 = padded[s1] ?? null;
      const p2 = padded[s2] ?? null;
      const isBye = p1 === null || p2 === null;
      return {
        tournamentId,
        round: 1,
        matchNumber: i + 1,
        player1Id: p1,
        player2Id: p2,
        winnerId: isBye ? (p1 ?? p2) : null,
        status: isBye ? TournamentMatchStatus.BYE : TournamentMatchStatus.PENDING,
      };
    });

    // Create placeholder matches for subsequent rounds
    const totalRounds = Math.log2(bracketSize);
    const futureMatches: typeof round1Matches = [];
    for (let r = 2; r <= totalRounds; r++) {
      const matchesInRound = bracketSize / Math.pow(2, r);
      for (let m = 1; m <= matchesInRound; m++) {
        futureMatches.push({
          tournamentId,
          round: r,
          matchNumber: m,
          player1Id: null,
          player2Id: null,
          winnerId: null,
          status: TournamentMatchStatus.PENDING,
        });
      }
    }

    return [...round1Matches, ...futureMatches];
  }

  private buildRoundRobinBracket(playerIds: string[], tournamentId: string) {
    const matches: {
      tournamentId: string;
      round: number;
      matchNumber: number;
      player1Id: string | null;
      player2Id: string | null;
      winnerId: null;
      status: TournamentMatchStatus;
    }[] = [];

    const n = playerIds.length;
    const players = n % 2 === 0 ? [...playerIds] : [...playerIds, null]; // null = BYE
    const totalRounds = players.length - 1;

    for (let round = 0; round < totalRounds; round++) {
      let matchNum = 1;
      for (let i = 0; i < players.length / 2; i++) {
        const p1 = players[i];
        const p2 = players[players.length - 1 - i];
        const isBye = p1 === null || p2 === null;
        matches.push({
          tournamentId,
          round: round + 1,
          matchNumber: matchNum++,
          player1Id: p1,
          player2Id: p2,
          winnerId: null,
          status: isBye ? TournamentMatchStatus.BYE : TournamentMatchStatus.PENDING,
        });
      }
      // Rotate: fix first player, rotate the rest
      players.splice(1, 0, players.pop()!);
    }

    return matches;
  }

  private buildSeedPairs(size: number): [number, number][] {
    // Build the standard single-elimination seeding pairs
    let pairs: [number, number][] = [[0, 1]];
    while (pairs.length < size / 2) {
      pairs = pairs.flatMap(([a, b]) => [
        [a, size - 1 - a] as [number, number],
        [b, size - 1 - b] as [number, number],
      ]);
    }
    return pairs;
  }

  private async retractWinner(
    tournamentId: string,
    currentRound: number,
    currentMatchNumber: number,
    oldWinnerId: string,
  ) {
    const nextRound = currentRound + 1;
    const nextMatchNumber = Math.ceil(currentMatchNumber / 2);
    const isPlayer1Slot = currentMatchNumber % 2 !== 0;

    const nextMatch = await this.prisma.tournamentMatch.findUnique({
      where: { tournamentId_round_matchNumber: { tournamentId, round: nextRound, matchNumber: nextMatchNumber } },
    });
    if (!nextMatch) return;

    if (nextMatch.status === TournamentMatchStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot change winner — the next-round match is already completed',
      );
    }

    // Only clear the slot if it still holds the old winner
    const update = isPlayer1Slot
      ? nextMatch.player1Id === oldWinnerId ? { player1Id: null } : {}
      : nextMatch.player2Id === oldWinnerId ? { player2Id: null } : {};

    if (Object.keys(update).length) {
      await this.prisma.tournamentMatch.update({ where: { id: nextMatch.id }, data: update });
    }
  }

  private async advanceWinner(
    tournamentId: string,
    currentRound: number,
    currentMatchNumber: number,
    winnerId: string,
  ) {
    const nextRound = currentRound + 1;
    // Which slot in the next round: odd match → player1, even → player2
    const nextMatchNumber = Math.ceil(currentMatchNumber / 2);
    const isPlayer1Slot = currentMatchNumber % 2 !== 0;

    const nextMatch = await this.prisma.tournamentMatch.findUnique({
      where: { tournamentId_round_matchNumber: { tournamentId, round: nextRound, matchNumber: nextMatchNumber } },
    });
    if (!nextMatch) return; // final already resolved

    await this.prisma.tournamentMatch.update({
      where: { id: nextMatch.id },
      data: isPlayer1Slot ? { player1Id: winnerId } : { player2Id: winnerId },
    });
  }

  private computeStandings(
    matches: { round: number; player1Id: string | null; player2Id: string | null; winnerId: string | null; status: TournamentMatchStatus }[],
    format: TournamentFormat,
  ): { userId: string; position: number }[] {
    if (format === TournamentFormat.SINGLE_ELIMINATION) {
      return this.singleEliminationStandings(matches);
    }
    return this.roundRobinStandings(matches);
  }

  private singleEliminationStandings(matches: { round: number; player1Id: string | null; player2Id: string | null; winnerId: string | null; status: TournamentMatchStatus }[]) {
    const maxRound = Math.max(...matches.map((m) => m.round));
    const final = matches.find((m) => m.round === maxRound)!;

    const standings: { userId: string; position: number }[] = [];

    // 1st: final winner
    if (final.winnerId) standings.push({ userId: final.winnerId, position: 1 });

    // 2nd: final loser
    const finalLoser = [final.player1Id, final.player2Id].find(
      (p) => p && p !== final.winnerId,
    );
    if (finalLoser) standings.push({ userId: finalLoser, position: 2 });

    // 3rd-4th: semi-final losers
    const semis = matches.filter((m) => m.round === maxRound - 1);
    let pos = 3;
    for (const semi of semis) {
      const loser = [semi.player1Id, semi.player2Id].find(
        (p) => p && p !== semi.winnerId,
      );
      if (loser) standings.push({ userId: loser, position: pos++ });
    }

    // Remaining rounds: bucket by round (earlier out = lower position)
    for (let r = maxRound - 2; r >= 1; r--) {
      const roundMatches = matches.filter((m) => m.round === r);
      for (const m of roundMatches) {
        const loser = [m.player1Id, m.player2Id].find(
          (p) => p && p !== m.winnerId,
        );
        if (loser) standings.push({ userId: loser, position: pos++ });
      }
    }

    return standings;
  }

  private roundRobinStandings(matches: { player1Id: string | null; player2Id: string | null; winnerId: string | null; status: TournamentMatchStatus }[]) {
    const wins = new Map<string, number>();

    for (const m of matches) {
      if (m.status !== TournamentMatchStatus.COMPLETED || !m.winnerId) continue;
      wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
    }

    return [...wins.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([userId], idx) => ({ userId, position: idx + 1 }));
  }
}
