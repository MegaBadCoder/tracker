import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageAdapter } from './s3-storage.adapter';

// Mock only S3Client (leave Command classes as real so .input works)
jest.mock('@aws-sdk/client-s3', () => {
  const actual =
    jest.requireActual<typeof import('@aws-sdk/client-s3')>(
      '@aws-sdk/client-s3',
    );
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner');

const MockS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>;

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'test-key',
    S3_SECRET_ACCESS_KEY: 'test-secret',
    S3_BUCKET: 'test-bucket',
    S3_FORCE_PATH_STYLE: 'true',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('S3StorageAdapter', () => {
  let sendMock: jest.Mock;
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMock = jest.fn().mockResolvedValue({});
    MockS3Client.mockImplementation(
      () => ({ send: sendMock }) as unknown as S3Client,
    );
    adapter = new S3StorageAdapter(makeConfig());
  });

  describe('upload', () => {
    it('calls S3Client.send with PutObjectCommand containing correct params', async () => {
      const body = Buffer.from('hello');

      await adapter.upload('some/key.jpg', body, 'image/jpeg');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const [command] = sendMock.mock.calls[0] as [PutObjectCommand];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'some/key.jpg',
        Body: body,
        ContentType: 'image/jpeg',
      });
    });
  });

  describe('getSignedReadUrl', () => {
    it('calls getSignedUrl with correct expiresIn and returns the result', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com/obj');

      const url = await adapter.getSignedReadUrl('some/key.jpg', 3600);

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const [, command, options] = mockGetSignedUrl.mock.calls[0] as [
        S3Client,
        GetObjectCommand,
        { expiresIn: number },
      ];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'some/key.jpg',
      });
      expect(options).toMatchObject({ expiresIn: 3600 });
      expect(url).toBe('https://signed-url.example.com/obj');
    });
  });

  describe('delete', () => {
    it('calls S3Client.send with DeleteObjectCommand for existing key', async () => {
      await adapter.delete('some/key.jpg');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const [command] = sendMock.mock.calls[0] as [DeleteObjectCommand];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'some/key.jpg',
      });
    });

    it('swallows NoSuchKey error (best-effort delete)', async () => {
      const noSuchKey = Object.assign(new Error('NoSuchKey'), {
        name: 'NoSuchKey',
      });
      sendMock.mockRejectedValue(noSuchKey);

      await expect(adapter.delete('missing/key.jpg')).resolves.toBeUndefined();
    });

    it('swallows NotFound error (best-effort delete)', async () => {
      const notFound = Object.assign(new Error('NotFound'), {
        name: 'NotFound',
      });
      sendMock.mockRejectedValue(notFound);

      await expect(adapter.delete('missing/key.jpg')).resolves.toBeUndefined();
    });

    it('re-throws other errors from delete', async () => {
      const networkError = Object.assign(new Error('Connection refused'), {
        name: 'NetworkError',
      });
      sendMock.mockRejectedValue(networkError);

      await expect(adapter.delete('some/key.jpg')).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
