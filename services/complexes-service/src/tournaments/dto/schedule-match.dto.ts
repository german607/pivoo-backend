import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ScheduleMatchDto {
  @IsDateString()
  scheduledAt: string;

  @IsString()
  @IsOptional()
  courtId?: string;
}
