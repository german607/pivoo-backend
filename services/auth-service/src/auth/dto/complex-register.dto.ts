import { IsEmail, IsString, IsUUID, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ComplexRegisterDto {
  @ApiProperty({ example: 'admin@complexopadel.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message: 'Password must contain uppercase, lowercase, a number, and a special character',
  })
  password: string;

  @ApiProperty({ description: 'UUID of the SportComplex this account manages' })
  @IsUUID()
  complexId: string;
}
