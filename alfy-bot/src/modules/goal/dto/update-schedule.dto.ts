import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'noExtraFields', async: false })
class NoExtraFieldsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const obj = args.object as UpdateScheduleDto;
    const prop = args.property;

    if (prop === 'days_of_week' && obj.frequency_type !== 'weekly_days') {
      return obj.days_of_week === undefined;
    }
    if (prop === 'interval_days' && obj.frequency_type !== 'interval') {
      return obj.interval_days === undefined;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} не нужен при frequency_type=${(args.object as UpdateScheduleDto).frequency_type}`;
  }
}

export class UpdateScheduleDto {
  @ApiProperty({
    example: 'daily',
    enum: ['daily', 'weekly_days', 'interval'],
    description:
      'Тип частоты. ' +
      'daily — каждый день (остальные поля не нужны). ' +
      'weekly_days — по конкретным дням недели (передать days_of_week). ' +
      'interval — раз в N дней (передать interval_days).',
  })
  @IsIn(['daily', 'weekly_days', 'interval'])
  frequency_type: string;

  @ApiPropertyOptional({
    example: [1, 3, 5],
    description:
      'Массив дней недели. 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб. ' +
      'Обязателен при frequency_type=weekly_days. Пример: [1,3,5] = Пн, Ср, Пт.',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @Validate(NoExtraFieldsConstraint)
  @ValidateIf((o) => o.frequency_type === 'weekly_days')
  @IsArray({ message: 'days_of_week должен быть массивом' })
  @ArrayNotEmpty({ message: 'days_of_week не может быть пустым' })
  @IsInt({
    each: true,
    message: 'Каждый элемент days_of_week должен быть целым числом',
  })
  @Min(0, { each: true, message: 'День недели не может быть меньше 0' })
  @Max(6, { each: true, message: 'День недели не может быть больше 6' })
  days_of_week?: number[];

  @ApiPropertyOptional({
    example: 3,
    description:
      'Интервал в днях (от начала цели). ' +
      'Обязателен при frequency_type=interval. Пример: 3 = каждые 3 дня.',
  })
  @Validate(NoExtraFieldsConstraint)
  @ValidateIf((o) => o.frequency_type === 'interval')
  @IsInt({ message: 'interval_days должен быть целым числом' })
  @Min(1, { message: 'interval_days должен быть не меньше 1' })
  interval_days?: number;
}
