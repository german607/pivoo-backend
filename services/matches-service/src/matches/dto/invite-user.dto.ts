import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Team } from '../../generated/prisma';

export class InviteUserDto {
  @ApiProperty({ description: 'ID of the registered user to invite' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: Team, required: false })
  @IsOptional()
  @IsEnum(Team)
  team?: Team;
}
