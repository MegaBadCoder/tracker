import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserEventsPort } from './domain/user-events.port';
import { EventsController } from './events.controller';
import { InMemoryUserEventsHub } from './infrastructure/in-memory-user-events.hub';

@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [{ provide: UserEventsPort, useClass: InMemoryUserEventsHub }],
  exports: [UserEventsPort],
})
export class EventsModule {}
