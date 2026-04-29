export abstract class TelegramUserLookupPort {
  abstract getTelegramChatId(userId: number): Promise<number | null>;
}
