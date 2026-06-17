import { toApiError } from "./api-errors";
import type { paths } from "./generated/schema";

export type ApiPath = keyof paths & string;

export interface ApiClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
  getAccessToken?: () => Promise<string | undefined>;
  fetcher?: typeof fetch;
  getCookieHeader?: () => Promise<string | undefined>;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: ApiPath;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClient {
  raw(options: ApiRequestOptions): Promise<Response>;
  request<TResponse>(options: ApiRequestOptions): Promise<TResponse>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetcher = options.fetcher ?? fetch;

  async function raw(requestOptions: ApiRequestOptions) {
    const accessToken = await options.getAccessToken?.();
    const cookieHeader = await options.getCookieHeader?.();

    return fetcher(buildUrl(options.baseUrl, requestOptions), {
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
      credentials: options.credentials ?? "include",
      headers: buildHeaders(accessToken, requestOptions.body, cookieHeader),
      method: requestOptions.method ?? "GET",
      signal: requestOptions.signal
    });
  }

  return {
    raw,
    async request<TResponse>(requestOptions: ApiRequestOptions) {
      const response = await raw(requestOptions);

      if (!response.ok) {
        throw await toApiError(response);
      }

      if (response.status === 204) {
        return undefined as TResponse;
      }

      return (await response.json()) as TResponse;
    }
  };
}

function buildUrl(baseUrl: string, options: ApiRequestOptions) {
  const url = new URL(options.path, baseUrl);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function buildHeaders(
  accessToken: string | undefined,
  body: unknown,
  cookieHeader: string | undefined
) {
  const headers = new Headers({
    accept: "application/json"
  });

  if (body) {
    headers.set("content-type", "application/json");
  }

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  return headers;
}
