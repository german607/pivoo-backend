import { IsString, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatsDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  sportId: string;

  @ApiProperty()
  @IsBoolean()
  won: boolean;

  @ApiProperty()
  @IsInt()
  pointsDelta: number;
}
