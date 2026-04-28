import { IsInt, IsOptional, Min } from 'class-validator';

export class ApproveRegistrationDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  seed?: number;
}
