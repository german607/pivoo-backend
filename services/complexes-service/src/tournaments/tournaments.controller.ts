import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ComplexAdminGuard } from '../common/guards/complex-admin.guard';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RecordMatchScoreDto } from './dto/record-match-score.dto';
import { SetRankingPointsDto } from './dto/set-ranking-points.dto';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { AssignPlayersDto } from './dto/assign-players.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { TournamentStatus } from '../generated/prisma';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly service: TournamentsService) {}

  // ─── Public ────────────────────────────────────────────────

  @Get()
  findAll(
    @Query('complexId') complexId?: string,
    @Query('sportId') sportId?: string,
    @Query('status') status?: TournamentStatus,
  ) {
    return this.service.findAll({ complexId, sportId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ─── Players (any authenticated user) ──────────────────────

  @Post(':id/register')
  @UseGuards(AuthGuard('jwt'))
  register(@Param('id') id: string, @Request() req: any) {
    return this.service.register(id, req.user.userId);
  }

  @Delete(':id/register')
  @UseGuards(AuthGuard('jwt'))
  withdraw(@Param('id') id: string, @Request() req: any) {
    return this.service.withdraw(id, req.user.userId);
  }

  // ─── Tournament lifecycle (complex admin) ───────────────────

  @Post()
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  create(@Body() dto: CreateTournamentDto, @Request() req: any) {
    return this.service.create(req.user.complexId, dto);
  }

  @Patch(':id/open-registration')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  openRegistration(@Param('id') id: string, @Request() req: any) {
    return this.service.openRegistration(id, req.user.complexId);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.service.cancel(id, req.user.complexId);
  }

  // ─── Registrations (complex admin) ─────────────────────────

  @Patch(':id/registrations/:userId/approve')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  approveRegistration(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: ApproveRegistrationDto,
    @Request() req: any,
  ) {
    return this.service.approveRegistration(id, userId, req.user.complexId, dto.seed);
  }

  @Patch(':id/registrations/:userId/reject')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  rejectRegistration(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.service.rejectRegistration(id, userId, req.user.complexId);
  }

  // ─── Bracket (complex admin) ────────────────────────────────

  @Post(':id/bracket')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  generateBracket(@Param('id') id: string, @Request() req: any) {
    return this.service.generateBracket(id, req.user.complexId);
  }

  // ─── Match management (complex admin) ──────────────────────

  @Post(':id/matches')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  createMatch(
    @Param('id') id: string,
    @Body() dto: CreateMatchDto,
    @Request() req: any,
  ) {
    return this.service.createMatch(id, req.user.complexId, dto);
  }

  @Patch(':id/matches/:matchId')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  updateMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: UpdateMatchDto,
    @Request() req: any,
  ) {
    return this.service.updateMatch(id, matchId, req.user.complexId, dto);
  }

  @Delete(':id/matches/:matchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  deleteMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Request() req: any,
  ) {
    return this.service.deleteMatch(id, matchId, req.user.complexId);
  }

  @Patch(':id/matches/:matchId/players')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  assignPlayers(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: AssignPlayersDto,
    @Request() req: any,
  ) {
    return this.service.assignPlayers(id, matchId, req.user.complexId, dto);
  }

  @Patch(':id/matches/:matchId/schedule')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  scheduleMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: ScheduleMatchDto,
    @Request() req: any,
  ) {
    return this.service.scheduleMatch(id, matchId, req.user.complexId, dto);
  }

  @Patch(':id/matches/:matchId/score')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  recordScore(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: RecordMatchScoreDto,
    @Request() req: any,
  ) {
    return this.service.recordScore(id, matchId, req.user.complexId, dto);
  }

  // ─── Ranking & finalization (complex admin) ─────────────────

  @Put(':id/ranking-points')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  setRankingPoints(
    @Param('id') id: string,
    @Body() dto: SetRankingPointsDto,
    @Request() req: any,
  ) {
    return this.service.setRankingPoints(id, req.user.complexId, dto);
  }

  @Post(':id/finalize')
  @UseGuards(AuthGuard('jwt'), ComplexAdminGuard)
  finalize(@Param('id') id: string, @Request() req: any) {
    return this.service.finalize(id, req.user.complexId);
  }
}
