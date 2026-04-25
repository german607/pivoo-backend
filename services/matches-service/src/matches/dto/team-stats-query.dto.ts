import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TeamStatsQueryDto {
  @ApiProperty({
    description: 'Comma-separated list of user IDs',
    example: 'uuid1,uuid2,uuid3',
  })
  @IsString()
  userIds: string;

  @ApiProperty({ required: false, description: 'Filter by sport ID (UUID)' })
  @IsOptional()
  @IsString()
  sportId?: string;
}
