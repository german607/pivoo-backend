export const TOPICS = {
  MATCH_PLAYER_INVITED: 'match.player.invited',
  MATCH_JOIN_REQUESTED: 'match.join.requested',
  MATCH_JOIN_APPROVED: 'match.join.approved',
  MATCH_WAITLIST_PROMOTED: 'match.waitlist.promoted',
  MATCH_JOIN_REJECTED: 'match.join.rejected',
  MATCH_CANCELLED: 'match.cancelled',
  MATCH_RESULT_RECORDED: 'match.result.recorded',
  TOURNAMENT_REGISTRATION_APPROVED: 'tournament.registration.approved',
  TOURNAMENT_REGISTRATION_REJECTED: 'tournament.registration.rejected',
  TOURNAMENT_BRACKET_GENERATED: 'tournament.bracket.generated',
  TOURNAMENT_FINALIZED: 'tournament.finalized',
  USER_FOLLOWED: 'user.followed',
} as const;

export interface MatchPlayerInvitedEvent {
  matchId: string;
  invitedUserId: string;
  scheduledAt: string;
  sportId: string;
}

export interface MatchJoinRequestedEvent {
  matchId: string;
  adminUserId: string;
  requestingUserId: string;
  scheduledAt: string;
  sportId: string;
}

export interface MatchWaitlistPromotedEvent {
  matchId: string;
  userId: string;
  scheduledAt: string;
  sportId: string;
}

export interface MatchJoinApprovedEvent {
  matchId: string;
  userId: string;
  scheduledAt: string;
  sportId: string;
}

export interface MatchJoinRejectedEvent {
  matchId: string;
  userId: string;
  sportId: string;
}

export interface MatchCancelledEvent {
  matchId: string;
  participantUserIds: string[];
  scheduledAt: string;
  sportId: string;
}

export interface MatchResultRecordedEvent {
  matchId: string;
  participantUserIds: string[];
  winnerTeam: string;
  sportId: string;
}

export interface TournamentRegistrationApprovedEvent {
  tournamentId: string;
  tournamentName: string;
  userId: string;
}

export interface TournamentRegistrationRejectedEvent {
  tournamentId: string;
  tournamentName: string;
  userId: string;
}

export interface TournamentBracketGeneratedEvent {
  tournamentId: string;
  tournamentName: string;
  participantUserIds: string[];
}

export interface TournamentFinalizedEvent {
  tournamentId: string;
  tournamentName: string;
  participantUserIds: string[];
  winnerId: string | null;
}

export interface UserFollowedEvent {
  followerId: string;
  followingId: string;
  followerUsername: string;
}
