import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Team } from '@prisma/client';

export class AddGuestDto {
  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'García' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ enum: Team, required: false })
  @IsOptional()
  @IsEnum(Team)
  team?: Team;
}
