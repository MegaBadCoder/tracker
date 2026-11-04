import {
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSprintDto {
  @ApiPropertyOptional({ example: 'Спринт 3' })
  @ValidateIf((o: UpdateSprintDto) => o.name !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Запустить онбординг', nullable: true })
  @IsOptional()
  @IsString()
  goal?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-01-14', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;
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
