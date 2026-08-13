import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { UserEvent, UserEventsPort } from '../domain/user-events.port';

@Injectable()
export class InMemoryUserEventsHub extends UserEventsPort {
  private readonly subjects = new Map<number, Subject<UserEvent>>();
  private readonly refs = new Map<number, number>();

  emit(userId: number, type: string): void {
    this.subjects.get(userId)?.next({ type, data: {} });
  }

  subscribe(userId: number): Observable<UserEvent> {
    let subject = this.subjects.get(userId);
    if (!subject) {
      subject = new Subject<UserEvent>();
      this.subjects.set(userId, subject);
    }
    this.refs.set(userId, (this.refs.get(userId) ?? 0) + 1);

    return new Observable((subscriber) => {
      const subscription = subject.subscribe(subscriber);
      return () => {
        subscription.unsubscribe();
        const remaining = (this.refs.get(userId) ?? 1) - 1;
        if (remaining <= 0) {
          this.refs.delete(userId);
          this.subjects.delete(userId);
          subject.complete();
        } else {
          this.refs.set(userId, remaining);
        }
      };
    });
  }
}
