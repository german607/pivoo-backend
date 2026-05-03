export enum TeamInviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  captainId: string;
  createdAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  invitedUserId: string;
  invitedByUserId: string;
  status: TeamInviteStatus;
  createdAt: Date;
}
