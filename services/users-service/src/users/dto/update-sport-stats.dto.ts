import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SkillLevel, Category } from '../../generated/prisma';

export class UpdateSportStatsDto {
  @ApiProperty({ enum: SkillLevel, required: false })
  @IsOptional()
  @IsEnum(SkillLevel)
  level?: SkillLevel;

  @ApiProperty({ enum: Category, required: false, nullable: true })
  @IsOptional()
  @IsEnum(Category)
  category?: Category | null;
}
