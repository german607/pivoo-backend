import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RematchDto {
  @ApiProperty({ example: '2026-06-01T10:00:00Z' })
  @IsDateString()
  scheduledAt!: string;
}
