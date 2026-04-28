import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SportName } from '../../generated/prisma';

export class CreateSportDto {
  @ApiProperty({ enum: SportName })
  @IsEnum(SportName)
  name: SportName;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(2)
  minPlayers: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(2)
  maxPlayers: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
