import { IsOptional, IsString } from 'class-validator';

export class AssignPlayersDto {
  @IsString()
  @IsOptional()
  player1Id?: string | null;

  @IsString()
  @IsOptional()
  player2Id?: string | null;
}
