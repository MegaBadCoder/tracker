import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance, AxiosResponse } from 'axios';

// We mock axios before importing rest-client
vi.mock('axios', () => {
  const mockInstance: Partial<AxiosInstance> = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
    __esModule: true,
  };
});

import axios from 'axios';
import { AlfyRestClient, RestError } from '../src/rest-client.js';

function makeAxiosMock() {
  return axios.create() as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

function makeAxiosResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config: {} as never };
}

function makeAxiosError(status: number, data: unknown, message = 'Request failed') {
  const err = new Error(message) as Error & { response?: AxiosResponse; isAxiosError: boolean };
  err.isAxiosError = true;
  err.response = { data, status, statusText: '', headers: {}, config: {} as never };
  return err;
}

describe('AlfyRestClient', () => {
  let client: AlfyRestClient;
  let mock: ReturnType<typeof makeAxiosMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AlfyRestClient('http://localhost:3002/api', 'token-abc');
    mock = makeAxiosMock();
  });

  describe('constructor / axios setup', () => {
    it('creates axios instance with baseURL, Authorization header, and timeout', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:3002/api',
          headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
          timeout: 30000,
        }),
      );
    });
  });

  describe('GET', () => {
    it('returns response data on success', async () => {
      mock.get.mockResolvedValueOnce(makeAxiosResponse({ id: 1, title: 'Test Task' }));
      const result = await client.get('/tasks/1');
      expect(result).toEqual({ id: 1, title: 'Test Task' });
    });

    it('passes params to axios.get', async () => {
      mock.get.mockResolvedValueOnce(makeAxiosResponse([]));
      await client.get('/tasks', { projectId: 42 });
      expect(mock.get).toHaveBeenCalledWith('/tasks', { params: { projectId: 42 } });
    });

    it('throws RestError with status and body on 404', async () => {
      mock.get
        .mockRejectedValueOnce(makeAxiosError(404, { message: 'Not found' }))
        .mockRejectedValueOnce(makeAxiosError(404, { message: 'Not found' }));
      await expect(client.get('/tasks/999')).rejects.toBeInstanceOf(RestError);
      await expect(client.get('/tasks/999')).rejects.toMatchObject({ status: 404 });
    });

    it('throws RestError on 500', async () => {
      mock.get.mockRejectedValueOnce(makeAxiosError(500, 'Internal Server Error'));
      const err = await client.get('/tasks').catch((e) => e);
      expect(err).toBeInstanceOf(RestError);
      expect(err.status).toBe(500);
    });

    it('re-throws non-axios errors as-is', async () => {
      const networkErr = new Error('ECONNREFUSED');
      mock.get.mockRejectedValueOnce(networkErr);
      await expect(client.get('/tasks')).rejects.toThrow('ECONNREFUSED');
      await expect(client.get('/tasks')).rejects.not.toBeInstanceOf(RestError);
    });
  });

  describe('POST', () => {
    it('returns response data on success', async () => {
      mock.post.mockResolvedValueOnce(makeAxiosResponse({ id: 5 }));
      const result = await client.post('/tasks', { title: 'New' });
      expect(result).toEqual({ id: 5 });
    });

    it('passes body to axios.post', async () => {
      mock.post.mockResolvedValueOnce(makeAxiosResponse({}));
      await client.post('/tasks', { title: 'New' });
      expect(mock.post).toHaveBeenCalledWith('/tasks', { title: 'New' });
    });

    it('throws RestError on 400', async () => {
      mock.post.mockRejectedValueOnce(makeAxiosError(400, { errors: ['title required'] }));
      const err = await client.post('/tasks').catch((e) => e);
      expect(err).toBeInstanceOf(RestError);
      expect(err.status).toBe(400);
      expect(err.body).toEqual({ errors: ['title required'] });
    });
  });

  describe('PATCH', () => {
    it('returns response data on success', async () => {
      mock.patch.mockResolvedValueOnce(makeAxiosResponse({ id: 1, done: true }));
      const result = await client.patch('/tasks/1', { done: true });
      expect(result).toEqual({ id: 1, done: true });
    });

    it('passes body to axios.patch', async () => {
      mock.patch.mockResolvedValueOnce(makeAxiosResponse({}));
      await client.patch('/tasks/1', { done: true });
      expect(mock.patch).toHaveBeenCalledWith('/tasks/1', { done: true });
    });

    it('throws RestError on 422', async () => {
      mock.patch.mockRejectedValueOnce(makeAxiosError(422, { message: 'Validation failed' }));
      const err = await client.patch('/tasks/1', {}).catch((e) => e);
      expect(err).toBeInstanceOf(RestError);
      expect(err.status).toBe(422);
    });
  });

  describe('DELETE', () => {
    it('returns response data on success', async () => {
      mock.delete.mockResolvedValueOnce(makeAxiosResponse(null));
      const result = await client.del('/tasks/1');
      expect(result).toBeNull();
    });

    it('calls axios.delete with path', async () => {
      mock.delete.mockResolvedValueOnce(makeAxiosResponse(null));
      await client.del('/tasks/1');
      expect(mock.delete).toHaveBeenCalledWith('/tasks/1');
    });

    it('throws RestError on 403', async () => {
      mock.delete.mockRejectedValueOnce(makeAxiosError(403, { message: 'Forbidden' }));
      const err = await client.del('/tasks/1').catch((e) => e);
      expect(err).toBeInstanceOf(RestError);
      expect(err.status).toBe(403);
    });
  });
});
