import { firstValueFrom } from 'rxjs';
import { InMemoryUserEventsHub } from './in-memory-user-events.hub';

describe('InMemoryUserEventsHub', () => {
  let hub: InMemoryUserEventsHub;

  beforeEach(() => {
    hub = new InMemoryUserEventsHub();
  });

  it('доставляет событие подписчику того же userId', async () => {
    const received = firstValueFrom(hub.subscribe(1));
    hub.emit(1, 'timer.updated');
    await expect(received).resolves.toEqual({
      type: 'timer.updated',
      data: {},
    });
  });

  it('не шлёт событие другому пользователю', () => {
    const received: string[] = [];
    const sub = hub.subscribe(1).subscribe((e) => received.push(e.type));
    hub.emit(2, 'timer.updated');
    sub.unsubscribe();
    expect(received).toEqual([]);
  });

  it('не падает, если подписчиков нет', () => {
    expect(() => hub.emit(1, 'timer.updated')).not.toThrow();
  });

  it('доставляет событие всем вкладкам одного пользователя', async () => {
    const a = firstValueFrom(hub.subscribe(1));
    const b = firstValueFrom(hub.subscribe(1));
    hub.emit(1, 'timer.updated');
    await expect(a).resolves.toEqual({ type: 'timer.updated', data: {} });
    await expect(b).resolves.toEqual({ type: 'timer.updated', data: {} });
  });
});
