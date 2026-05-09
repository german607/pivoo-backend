export const NOTIFICATION_TOPICS = {
  TOURNAMENT_REGISTRATION_APPROVED: 'tournament.registration.approved',
  TOURNAMENT_REGISTRATION_REJECTED: 'tournament.registration.rejected',
  TOURNAMENT_BRACKET_GENERATED: 'tournament.bracket.generated',
  TOURNAMENT_FINALIZED: 'tournament.finalized',
} as const;

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
