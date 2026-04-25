import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('teams')
@Controller('teams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  // ──────────────────────────────────────────────────────────
  // My teams / invitations
  // ──────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'List all teams I belong to' })
  getMyTeams(@Request() req: any) {
    return this.teamsService.getMyTeams(req.user.userId);
  }

  @Get('invitations/me')
  @ApiOperation({ summary: 'List my pending invitations' })
  getMyInvitations(@Request() req: any) {
    return this.teamsService.getMyInvitations(req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Team CRUD
  // ──────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new team (caller becomes admin)' })
  create(@Request() req: any, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(req.user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team details with members and pending invitations' })
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team name or color (admin only)' })
  update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disband the team and remove all members (admin only)' })
  disband(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.disband(id, req.user.userId);
  }

  // ──────────────────────────────────────────────────────────
  // Invite flow
  // ──────────────────────────────────────────────────────────

  @Post(':id/invitations')
  @ApiOperation({ summary: 'Invite a registered user to the team (admin only)' })
  inviteMember(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamsService.inviteMember(id, req.user.userId, dto);
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List pending invitations for this team (admin only)' })
  getPendingInvitations(@Param('id') id: string, @Request() req: any) {
    return this.teamsService.getPendingInvitations(id, req.user.userId);
  }

  @Patch('invitations/:invId/accept')
  @ApiOperation({ summary: 'Accept a team invitation' })
  acceptInvitation(@Param('invId') invId: string, @Request() req: any) {
    return this.teamsService.respondToInvitation(invId, req.user.userId, true);
  }

  @Patch('invitations/:invId/decline')
  @ApiOperation({ summary: 'Decline a team invitation' })
  declineInvitation(@Param('invId') invId: string, @Request() req: any) {
    return this.teamsService.respondToInvitation(invId, req.user.userId, false);
  }

  // ──────────────────────────────────────────────────────────
  // Member management
  // ──────────────────────────────────────────────────────────

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the team (admin only)' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.teamsService.removeMember(id, req.user.userId, userId);
  }

  // ──────────────────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────────────────

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get team stats computed from shared matches' })
  @ApiQuery({ name: 'sportId', required: false, description: 'Filter by sport UUID' })
  getTeamStats(
    @Param('id') id: string,
    @Query('sportId') sportId?: string,
  ) {
    return this.teamsService.getTeamStats(id, sportId);
  }
}
