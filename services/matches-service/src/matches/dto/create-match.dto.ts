import {
  IsString, IsDateString, IsInt, IsOptional, IsEnum, Min, Max, IsIn, ValidateNested, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SkillLevel } from '../../generated/prisma';
import { Category, Gender, MatchMode } from '../../types/match.types';

export class RecurrenceDto {
  @ApiProperty({ enum: ['WEEKLY', 'BIWEEKLY'] })
  @IsIn(['WEEKLY', 'BIWEEKLY'])
  type!: 'WEEKLY' | 'BIWEEKLY';

  @ApiProperty({ example: 4, description: 'Total de instancias a generar (incluye la primera)' })
  @IsInt()
  @Min(2)
  @Max(52)
  count!: number;
}

export class CreateMatchDto {
  @ApiProperty()
  @IsString()
  sportId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  complexId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  complexName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiProperty({ example: '2026-05-01T10:00:00Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(2)
  @Max(8)
  maxPlayers!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(2)
  minPlayers!: number;

  @ApiProperty({ enum: SkillLevel, required: false, description: 'Nivel requerido (excluyente con requiredCategory)' })
  @IsOptional()
  @IsEnum(SkillLevel)
  requiredLevel?: SkillLevel;

  @ApiProperty({ enum: Category, required: false, description: 'Categoría requerida (excluyente con requiredLevel)' })
  @IsOptional()
  @IsEnum(Category)
  requiredCategory?: Category;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Si se provee, crea instancias recurrentes del partido' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;

  @ApiProperty({ required: false, description: 'ID de plantilla para pre-llenar los campos' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ enum: MatchMode, required: false, default: MatchMode.INDIVIDUAL })
  @IsOptional()
  @IsEnum(MatchMode)
  mode?: MatchMode;

  @ApiProperty({ required: false, description: 'ID del compañero de equipo (requerido si mode=TEAM_VS_TEAM)' })
  @ValidateIf((o) => o.mode === MatchMode.TEAM_VS_TEAM)
  @IsString()
  partnerId?: string;
}
