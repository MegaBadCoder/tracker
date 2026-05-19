import axios from 'axios';
import type { AxiosInstance } from 'axios';

export class RestError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(`REST ${status}: ${message}`);
    this.name = 'RestError';
  }
}

function isAxiosError(err: unknown): err is { response?: { status: number; data: unknown }; isAxiosError: boolean } {
  return typeof err === 'object' && err !== null && (err as { isAxiosError?: boolean }).isAxiosError === true;
}

export class AlfyRestClient {
  private readonly http: AxiosInstance;

  constructor(base: string, token: string) {
    this.http = axios.create({
      baseURL: base,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.http.get<T>(path, { params });
      return res.data;
    } catch (err) {
      throw this.#wrapError(err);
    }
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    try {
      const res = await this.http.post<T>(path, body);
      return res.data;
    } catch (err) {
      throw this.#wrapError(err);
    }
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    try {
      const res = await this.http.patch<T>(path, body);
      return res.data;
    } catch (err) {
      throw this.#wrapError(err);
    }
  }

  async del<T>(path: string): Promise<T> {
    try {
      const res = await this.http.delete<T>(path);
      return res.data;
    } catch (err) {
      throw this.#wrapError(err);
    }
  }

  #wrapError(err: unknown): unknown {
    if (isAxiosError(err) && err.response) {
      const { status, data } = err.response;
      const message = typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : String(data);
      return new RestError(status, message, data);
    }
    return err;
  }
}
