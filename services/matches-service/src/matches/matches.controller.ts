import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus, Headers, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { RematchDto } from './dto/rematch.dto';
import { CreateMatchTemplateDto } from './dto/create-match-template.dto';
import { ChallengeMatchDto } from './dto/challenge-match.dto';
import { TeamStatsQueryDto } from './dto/team-stats-query.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getClientIp, getCountryFromIp } from '../common/geo';
import { MatchStatus, Team } from '../generated/prisma';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(
    private matchesService: MatchesService,
    private config: ConfigService,
  ) {}

  @Patch('expire-past')
  @ApiOperation({ summary: 'Close all past OPEN/FULL matches (service key required)' })
  expirePastMatches(@Headers('x-service-key') key: string) {
    if (key !== this.config.get('SERVICE_KEY')) {
      throw new UnauthorizedException('Invalid service key');
    }
    return this.matchesService.expirePastMatches();
  }

  // ──────────────────────────────────────────────────────────
  // Match CRUD
  // ──────────────────────────────────────────────────────────

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List open matches with optional filters. Authenticated users auto-filter by their country.' })
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'complexId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: MatchStatus })
  @ApiQuery({ name: 'country', required: false, description: 'ISO country code override (e.g. UY, AR, ES)' })
  @ApiQuery({ name: 'mode', required: false, enum: ['INDIVIDUAL', 'TEAM_VS_TEAM'] })
  findAll(
    @Request() req: any,
    @Query('sportId') sportId?: string,
    @Query('complexId') complexId?: string,
    @Query('status') status?: MatchStatus,
    @Query('country') country?: string,
    @Query('mode') mode?: string,
  ) {
    const effectiveCountry =
      country ??
      (req.user?.country as string | null) ??
      getCountryFromIp(getClientIp(req)) ??
      undefined;
    return this.matchesService.findAll({ sportId, complexId, status, country: effectiveCountry, mode });
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all matches for the authenticated user (all statuses, ordered by date desc)' })
  findMine(@Request() req: any) {
    return this.matchesService.findMine(req.user.userId);
  }

  // Must be declared before :id to avoid "team-stats" being matched as an id
  @Get('team-stats')
  @ApiOperation({ summary: 'Compute stats for a set of users playing together (used by teams-service)' })
  getTeamStats(@Query() query: TeamStatsQueryDto) {
    const userIds = query.userIds.split(',').map((id) => id.trim()).filter(Boolean);
    return this.matchesService.getTeamStats(userIds, query.sportId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match details including all participants' })
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new match (creator becomes admin + first participant)' })
  create(@Request() req: any, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(req.user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a match (admin only)' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.cancelMatch(id, req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Request-to-join flow (registered user self-joins)
  // ──────────────────────────────────────────────────────────

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request to join a match (registered user)' })
  requestToJoin(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.requestToJoin(id, req.user.userId);
  }

  @Patch(':id/participants/:userId/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a pending join request (admin only)' })
  @ApiQuery({ name: 'team', required: false, enum: Team })
  approve(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Query('team') team: Team | undefined,
    @Request() req: any,
  ) {
    return this.matchesService.respondToRequest(id, userId, req.user.userId, true, team);
  }

  @Patch(':id/participants/:userId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending join request (admin only)' })
  reject(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.matchesService.respondToRequest(id, userId, req.user.userId, false);
  }

  // ──────────────────────────────────────────────────────────
  // Invite flow (admin invites a registered user)
  // ──────────────────────────────────────────────────────────

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a registered user to the match (admin only)' })
  inviteUser(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: InviteUserDto,
  ) {
    return this.matchesService.inviteUser(id, req.user.userId, dto);
  }

  @Patch(':id/invite/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a match invitation (invited user)' })
  acceptInvite(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.acceptInvite(id, req.user.userId);
  }

  @Patch(':id/invite/decline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decline a match invitation (invited user)' })
  declineInvite(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.declineInvite(id, req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Guest flow (admin adds a guest player by name)
  // ──────────────────────────────────────────────────────────

  @Post(':id/guests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a guest player to the match (admin only, auto-approved)' })
  addGuest(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AddGuestDto,
  ) {
    return this.matchesService.addGuest(id, req.user.userId, dto);
  }

  // ──────────────────────────────────────────────────────────
  // Remove participant (admin removes anyone)
  // ──────────────────────────────────────────────────────────

  @Patch(':id/participants/:participantId/team')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change a participant team (admin only)' })
  @ApiQuery({ name: 'team', required: false, enum: Team })
  changeParticipantTeam(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Query('team') team: Team | undefined,
    @Request() req: any,
  ) {
    return this.matchesService.changeParticipantTeam(id, participantId, req.user.userId, team ?? null);
  }

  @Delete(':id/participants/:participantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a participant from the match (admin only). Works for guests, invited, pending and approved players.',
  })
  removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @Request() req: any,
  ) {
    return this.matchesService.removeParticipant(id, participantId, req.user.userId);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a match (authenticated user removes themselves)' })
  leaveMatch(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.leaveMatch(id, req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Team vs Team — challenge flow
  // ──────────────────────────────────────────────────────────

  @Post(':id/challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Challenge a TEAM_VS_TEAM match as Team B (sends both players as pending)' })
  challengeMatch(@Param('id') id: string, @Request() req: any, @Body() dto: ChallengeMatchDto) {
    return this.matchesService.challengeMatch(id, req.user.userId, dto);
  }

  @Post(':id/approve-challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve all pending Team B players at once (admin only)' })
  approveChallenge(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.approveChallenge(id, req.user.userId);
  }

  @Post(':id/reject-challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject all pending Team B players at once (admin only)' })
  rejectChallenge(@Param('id') id: string, @Request() req: any) {
    return this.matchesService.rejectChallenge(id, req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Rematch (#14)
  // ──────────────────────────────────────────────────────────

  @Post(':id/rematch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a rematch from a completed or cancelled match (admin only)' })
  rematch(@Param('id') id: string, @Request() req: any, @Body() dto: RematchDto) {
    return this.matchesService.rematch(id, req.user.userId, dto);
  }

  // ──────────────────────────────────────────────────────────
  // Match templates (#15)
  // ──────────────────────────────────────────────────────────

  @Post('templates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a match template' })
  createTemplate(@Request() req: any, @Body() dto: CreateMatchTemplateDto) {
    return this.matchesService.createTemplate(req.user.userId, dto);
  }

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my match templates' })
  findMyTemplates(@Request() req: any) {
    return this.matchesService.findMyTemplates(req.user.userId);
  }

  @Delete('templates/:templateId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a match template' })
  deleteTemplate(@Param('templateId') templateId: string, @Request() req: any) {
    return this.matchesService.deleteTemplate(templateId, req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Result recording
  // ──────────────────────────────────────────────────────────

  @Post(':id/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record match result and update stats for registered players' })
  recordResult(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: RecordResultDto,
  ) {
    return this.matchesService.recordResult(id, req.user.userId, dto);
  }
}
