export abstract class EmailNotificationPort {
  abstract sendVerificationCode(to: string, code: string): Promise<void>;
}
