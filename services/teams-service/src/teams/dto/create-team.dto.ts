import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ example: 'Los Invencibles', minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ required: false, description: 'Sport UUID from sports-service (null = multi-sport)' })
  @IsOptional()
  @IsString()
  sportId?: string;

  @ApiProperty({ required: false, example: '#14B8A6', description: 'Hex color for the team avatar' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g. #14B8A6)' })
  color?: string;
}
