/**
 * Thin, generic HTTP client for the AutoDeck backend, shared by every
 * frontend surface (customer-mobile, studio-mobile, admin-web). Phase 3A
 * foundation only: deliberately has NO endpoint-specific methods (no
 * `createBooking()`, `consumePackage()`, etc.) — those encode business
 * knowledge that belongs to later phases, once each screen is actually
 * built. This package only solves the cross-cutting concerns every one of
 * those future calls will need: base URL, auth-token attachment, response
 * parsing, and error normalization.
 *
 * Deliberately has no dependency on any specific auth SDK: `getIdToken` is
 * injected by the calling app (backed by Firebase Auth's
 * `user.getIdToken()` in practice), so this package stays testable and
 * platform-agnostic. Uses the runtime's global `fetch` (available in
 * Node 18+, React Native, and every browser) rather than adding an HTTP
 * client dependency.
 */

export interface ApiClientConfig {
  /** e.g. `http://localhost:3000` in development against the emulator-backed backend. */
  baseUrl: string;
  /** Returns the current Firebase ID token, or `null` if signed out. */
  getIdToken: () => Promise<string | null>;
  /**
   * Called whenever the backend responds 401 (invalid/expired/revoked
   * token) — the app wires this to its own sign-out logic. The client
   * itself never mutates auth state; it only reports the signal.
   */
  onUnauthorized?: () => void;
}

/** A well-formed backend response indicating failure (4xx/5xx). Carries
 * the HTTP status and whatever body the backend returned, so callers can
 * distinguish e.g. 404 (not found) from 409 (conflict) from 403 (forbidden)
 * without the client guessing at business meaning. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** The request never reached the backend at all (offline, DNS failure,
 * timeout, CORS, etc.) — distinguished from ApiError so the UI can show a
 * "check your connection" state rather than a backend-error state. */
export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const idToken = await config.getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new NetworkError(cause);
    }

    if (response.status === 401) {
      config.onUnauthorized?.();
    }

    if (!response.ok) {
      const parsedBody = await safeParseJson(response);
      const message =
        (parsedBody as { message?: string } | undefined)?.message ??
        `Request failed with status ${response.status}`;
      throw new ApiError(response.status, message, parsedBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await safeParseJson(response)) as T;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  };
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
