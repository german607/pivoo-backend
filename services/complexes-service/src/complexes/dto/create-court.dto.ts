import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourtDto {
  @ApiProperty()
  @IsString()
  sportId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  indoor?: boolean;
}
