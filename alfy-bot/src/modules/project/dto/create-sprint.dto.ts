import { IsInt, Min, Max, ValidateIf } from 'class-validator';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSprintDto {
  @ApiPropertyOptional({ example: 'Спринт 3' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Запустить онбординг' })
  @IsOptional()
  @IsString()
  goal?: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Доступное время в минутах; null — бюджет не задан',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  capacityMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Резерв времени в минутах' })
  @ValidateIf(
    (o: { reserveMinutes?: number }) => o.reserveMinutes !== undefined,
  )
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  reserveMinutes?: number;
}
