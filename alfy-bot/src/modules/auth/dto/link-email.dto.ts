import { IsEmail, IsString, MinLength } from 'class-validator';
import { Match } from '../../../shared/validators/match.decorator';

export class LinkEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @Match('password')
  confirmPassword: string;
}
