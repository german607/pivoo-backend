import { IsArray, IsEnum, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Team } from '@prisma/client';

class SetScoreDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  setNumber: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  teamAScore: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  teamBScore: number;
}

export class RecordResultDto {
  @ApiProperty({ type: [SetScoreDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetScoreDto)
  sets: SetScoreDto[];

  @ApiProperty({ enum: Team })
  @IsEnum(Team)
  winnerTeam: Team;
}
