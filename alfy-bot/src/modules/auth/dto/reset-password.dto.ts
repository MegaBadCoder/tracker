import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { Match } from '../../../shared/validators/match.decorator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @MinLength(6)
  newPassword: string;

  @IsString()
  @Match('newPassword')
  confirmPassword: string;
}
