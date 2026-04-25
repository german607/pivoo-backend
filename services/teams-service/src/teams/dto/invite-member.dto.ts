import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({ description: 'User ID of the registered user to invite' })
  @IsString()
  userId: string;
}
