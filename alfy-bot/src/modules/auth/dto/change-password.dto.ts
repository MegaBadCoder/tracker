import { IsString, MinLength } from 'class-validator';
import { Match } from '../../../shared/validators/match.decorator';

export class ChangePasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;

  @IsString()
  @Match('newPassword')
  confirmPassword: string;
}
