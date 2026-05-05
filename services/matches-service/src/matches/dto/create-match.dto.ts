import {
  IsString, IsDateString, IsInt, IsOptional, IsEnum, Min, Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SkillLevel } from '../../generated/prisma';
import { Category, Gender } from '../../types/match.types';

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
}
