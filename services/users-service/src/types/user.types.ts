export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  PROFESSIONAL = 'PROFESSIONAL',
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}

export interface UserSportStats {
  userId: string;
  sportId: string;
  matchesPlayed: number;
  matchesWon: number;
  rankingPoints: number;
  level: SkillLevel;
}
