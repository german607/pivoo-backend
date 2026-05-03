export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  PROFESSIONAL = 'PROFESSIONAL',
}

export enum Category {
  PRIMERA = 'PRIMERA',
  SEGUNDA = 'SEGUNDA',
  TERCERA = 'TERCERA',
  CUARTA = 'CUARTA',
  QUINTA = 'QUINTA',
  SEXTA = 'SEXTA',
  SEPTIMA = 'SEPTIMA',
  OCTAVA = 'OCTAVA',
}

export enum Gender {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
  MIXTO = 'MIXTO',
}

export enum MatchStatus {
  OPEN = 'OPEN',
  FULL = 'FULL',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ParticipantStatus {
  PENDING = 'PENDING',
  INVITED = 'INVITED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ParticipantType {
  REGISTERED = 'REGISTERED',
  GUEST = 'GUEST',
}

export enum Team {
  TEAM_A = 'TEAM_A',
  TEAM_B = 'TEAM_B',
}

export interface Match {
  id: string;
  sportId: string;
  complexId: string;
  courtId: string;
  adminUserId: string;
  scheduledAt: Date;
  maxPlayers: number;
  minPlayers: number;
  requiredLevel: SkillLevel | null;
  requiredCategory: Category | null;
  gender: Gender | null;
  status: MatchStatus;
  description: string | null;
  createdAt: Date;
}

export interface MatchParticipant {
  id: string;
  matchId: string;
  userId: string;
  status: ParticipantStatus;
  team: Team | null;
  joinedAt: Date;
}

export interface SetScore {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
}

export interface MatchResult {
  id: string;
  matchId: string;
  sets: SetScore[];
  winnerTeam: Team;
  recordedAt: Date;
}
