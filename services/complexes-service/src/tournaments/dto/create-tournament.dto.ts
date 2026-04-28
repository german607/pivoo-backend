import { IsString, IsEnum, IsInt, IsOptional, IsDateString, Min } from 'class-validator';
import { TournamentFormat } from '../../generated/prisma';

export class CreateTournamentDto {
  @IsString()
  name: string;

  @IsString()
  sportId: string;

  @IsEnum(TournamentFormat)
  @IsOptional()
  format?: TournamentFormat;

  @IsInt()
  @Min(2)
  maxParticipants: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
