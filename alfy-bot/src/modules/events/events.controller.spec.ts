import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Test } from '@nestjs/testing';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { UserEventsPort } from './domain/user-events.port';
import { EventsController } from './events.controller';
import { InMemoryUserEventsHub } from './infrastructure/in-memory-user-events.hub';

describe('EventsController', () => {
  let controller: EventsController;
  let hub: InMemoryUserEventsHub;

  beforeEach(async () => {
    hub = new InMemoryUserEventsHub();
    const module = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: UserEventsPort, useValue: hub }],
    })
      .overrideGuard(JwtOrApiTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EventsController);
  });

  it('стримит события текущего пользователя', async () => {
    const stream = controller.stream({ user: { sub: 7 } } as never);
    const received = firstValueFrom(
      stream.pipe(filter((e) => e.type === 'timer.updated')),
    );
    hub.emit(7, 'timer.updated');
    await expect(received).resolves.toEqual({
      type: 'timer.updated',
      data: {},
    });
  });
});
