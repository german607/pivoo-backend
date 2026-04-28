import { IsArray, IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SetScoreDto {
  @IsString()
  player1: string;

  @IsString()
  player2: string;
}

export class RecordMatchScoreDto {
  @IsString()
  winnerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetScoreDto)
  sets: SetScoreDto[];
}
