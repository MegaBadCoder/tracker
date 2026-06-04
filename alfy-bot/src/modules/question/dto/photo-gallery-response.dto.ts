import { ApiProperty } from '@nestjs/swagger';

export class PhotoGalleryEntryDto {
  @ApiProperty({ example: '2026-05-22' })
  scheduled_date: string;

  @ApiProperty({ example: 'https://s3.timeweb.cloud/...' })
  url: string;
}
