export abstract class NotificationPort {
  abstract send(userId: number, message: string): Promise<void>;
}
