export const NOTIFICATION_TOPICS = {
  MATCH_PLAYER_INVITED: 'match.player.invited',
  MATCH_JOIN_REQUESTED: 'match.join.requested',
  MATCH_JOIN_APPROVED: 'match.join.approved',
  MATCH_JOIN_REJECTED: 'match.join.rejected',
  MATCH_CANCELLED: 'match.cancelled',
  MATCH_RESULT_RECORDED: 'match.result.recorded',
  MATCH_WAITLIST_PROMOTED: 'match.waitlist.promoted',
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

export interface MatchWaitlistPromotedEvent {
  matchId: string;
  userId: string;
  scheduledAt: string;
  sportId: string;
}
