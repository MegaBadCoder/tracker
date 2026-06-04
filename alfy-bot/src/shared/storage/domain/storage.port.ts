export abstract class StoragePort {
  abstract upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;

  abstract getSignedReadUrl(key: string, ttlSeconds: number): Promise<string>;

  abstract delete(key: string): Promise<void>;
}
