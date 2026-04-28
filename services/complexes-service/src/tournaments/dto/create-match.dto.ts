import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TournamentMatchStatus } from '../../generated/prisma';

export class CreateMatchDto {
  @IsInt()
  @Min(1)
  round: number;

  @IsInt()
  @Min(1)
  matchNumber: number;

  @IsString()
  @IsOptional()
  player1Id?: string;

  @IsString()
  @IsOptional()
  player2Id?: string;

  @IsString()
  @IsOptional()
  courtId?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsEnum(TournamentMatchStatus)
  @IsOptional()
  status?: TournamentMatchStatus;
}
