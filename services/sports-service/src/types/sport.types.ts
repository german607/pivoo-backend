export enum SportName {
  TENNIS = 'TENNIS',
  PADEL = 'PADEL',
}

export interface Sport {
  id: string;
  name: SportName;
  minPlayers: number;
  maxPlayers: number;
  description: string | null;
  createdAt: Date;
}
