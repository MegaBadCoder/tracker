import { Observable } from 'rxjs';

export interface UserEvent {
  type: string;
  data: Record<string, never>;
}

export abstract class UserEventsPort {
  abstract emit(userId: number, type: string): void;
  abstract subscribe(userId: number): Observable<UserEvent>;
}
