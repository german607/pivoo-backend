import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChallengeMatchDto {
  @ApiProperty({ description: 'ID del compañero de equipo (Team B)' })
  @IsString()
  partnerId!: string;
}
