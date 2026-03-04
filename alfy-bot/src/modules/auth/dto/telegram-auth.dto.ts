import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class TelegramAuthDto {
  // --- WebApp flow ---
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  initData?: string;

  // --- Login Widget flow ---
  @IsOptional()
  @IsInt()
  @IsPositive()
  id?: number;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsInt()
  auth_date?: number;

  @IsOptional()
  @IsString()
  hash?: string;

  // --- Dev flow ---
  @IsOptional()
  @IsInt()
  @IsPositive()
  devTelegramId?: number;
}
