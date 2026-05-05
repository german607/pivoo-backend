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

export enum TournamentStatus {
  DRAFT = 'DRAFT',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TournamentFormat {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum TournamentMatchStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BYE = 'BYE',
}

export interface SportComplex {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}

export interface Court {
  id: string;
  complexId: string;
  sportId: string;
  name: string;
  indoor: boolean;
}

export interface Tournament {
  id: string;
  complexId: string;
  sportId: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  startDate: Date | null;
  endDate: Date | null;
  category: Category | null;
  gender: Gender | null;
  createdAt: Date;
}
