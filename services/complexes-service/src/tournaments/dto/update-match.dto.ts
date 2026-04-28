import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TournamentMatchStatus } from '../../generated/prisma';

export class UpdateMatchDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  round?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  matchNumber?: number;

  @IsEnum(TournamentMatchStatus)
  @IsOptional()
  status?: TournamentMatchStatus;

  @IsString()
  @IsOptional()
  courtId?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
