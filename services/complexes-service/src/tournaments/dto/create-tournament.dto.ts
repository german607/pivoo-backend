import { IsString, IsEnum, IsInt, IsOptional, IsDateString, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentFormat } from '../../generated/prisma';
import { Category, Gender, SkillLevel } from '../../types/complex.types';

export class CreateTournamentDto {
  @ApiProperty({ example: 'Copa Verano 2026' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'uuid-del-deporte' })
  @IsString()
  @IsNotEmpty()
  sportId: string;

  @ApiPropertyOptional({ enum: TournamentFormat, default: TournamentFormat.SINGLE_ELIMINATION })
  @IsOptional()
  @IsEnum(TournamentFormat)
  format?: TournamentFormat;

  @ApiProperty({ example: 16 })
  @IsInt()
  @Min(2)
  maxParticipants: number;

  @ApiProperty({ example: '2026-06-01T09:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-05-25T23:59:00Z' })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SkillLevel, description: 'Nivel requerido. Excluyente con categoría.' })
  @IsOptional()
  @IsEnum(SkillLevel)
  level?: SkillLevel;

  @ApiPropertyOptional({ enum: Category, description: 'Categoría (1ra a 8va). Excluyente con nivel.' })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
