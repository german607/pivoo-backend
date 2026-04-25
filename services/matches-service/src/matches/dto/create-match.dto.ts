import {
  IsString, IsDateString, IsInt, IsOptional, IsEnum, Min, Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SkillLevel } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty()
  @IsString()
  sportId: string;

  @ApiProperty()
  @IsString()
  complexId: string;

  @ApiProperty()
  @IsString()
  courtId: string;

  @ApiProperty({ example: '2026-05-01T10:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(2)
  @Max(8)
  maxPlayers: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(2)
  minPlayers: number;

  @ApiProperty({ enum: SkillLevel, required: false })
  @IsOptional()
  @IsEnum(SkillLevel)
  requiredLevel?: SkillLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
