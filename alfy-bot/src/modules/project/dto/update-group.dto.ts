import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {
  @ApiPropertyOptional({ enum: ['open', 'done'] })
  @IsOptional()
  @IsIn(['open', 'done'])
  status?: 'open' | 'done';
}
