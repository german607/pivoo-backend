import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RankingPointEntryDto {
  @IsInt()
  @Min(1)
  position: number;

  @IsInt()
  @Min(0)
  points: number;
}

export class SetRankingPointsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RankingPointEntryDto)
  points: RankingPointEntryDto[];
}
