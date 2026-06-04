import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoragePort } from './domain/storage.port';
import { S3StorageAdapter } from './infrastructure/s3-storage.adapter';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: StoragePort, useClass: S3StorageAdapter }],
  exports: [StoragePort],
})
export class StorageModule {}
