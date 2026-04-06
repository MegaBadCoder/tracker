export abstract class UserSettingsPort {
  abstract getTimezone(userId: number): Promise<string>;
}
