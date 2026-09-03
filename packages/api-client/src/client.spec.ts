import { ApiError, NetworkError, createApiClient } from './client';

function mockFetchResponse(options: { status: number; body?: unknown; ok?: boolean }) {
  const { status, body, ok = status >= 200 && status < 300 } = options;
  return {
    status,
    ok,
    text: jest.fn().mockResolvedValue(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

describe('createApiClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('attaches the Authorization header when an ID token is available', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200, body: { ok: true } }));
    const getIdToken = jest.fn().mockResolvedValue('token-123');
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken });

    await client.get('/health/secure');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/health/secure',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) }),
    );
  });

  it('omits the Authorization header when signed out', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200, body: { ok: true } }));
    const getIdToken = jest.fn().mockResolvedValue(null);
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken });

    await client.get('/health');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('sends a JSON-serialized body for post/patch', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 201, body: { id: '1' } }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    await client.post('/customers', { name: 'Anita' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ name: 'Anita' }));
  });

  it('parses a successful JSON response', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200, body: { customerId: 'c1' } }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    const result = await client.get<{ customerId: string }>('/customers/c1');
    expect(result).toEqual({ customerId: 'c1' });
  });

  it('returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 204 }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    const result = await client.patch('/bookings/bk-1/cancel');
    expect(result).toBeUndefined();
  });

  it('throws ApiError with the status and backend-provided message on a 4xx/5xx response', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({ status: 409, body: { message: 'A payment order already exists for this booking' } }),
    );
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    await expect(client.post('/bookings/bk-1/payment-order')).rejects.toMatchObject({
      status: 409,
      message: 'A payment order already exists for this booking',
    });
  });

  it('throws ApiError (not NetworkError) for a well-formed error response', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 404, body: { message: 'Not found' } }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    await expect(client.get('/customers/ghost')).rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to a generic message when the error body has no message field', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 500 }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    await expect(client.get('/x')).rejects.toMatchObject({ status: 500, message: 'Request failed with status 500' });
  });

  it('throws NetworkError when fetch itself rejects (offline, DNS failure, etc.)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => null });

    await expect(client.get('/health')).rejects.toBeInstanceOf(NetworkError);
  });

  it('calls onUnauthorized on a 401 response, and still throws ApiError', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 401, body: { message: 'Authentication failed' } }));
    const onUnauthorized = jest.fn();
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => 'expired', onUnauthorized });

    await expect(client.get('/health/secure')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnauthorized for a non-401 error', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 403, body: { message: 'Forbidden' } }));
    const onUnauthorized = jest.fn();
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => 'token', onUnauthorized });

    await expect(client.get('/staff')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not throw if onUnauthorized is not provided', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 401, body: { message: 'Authentication failed' } }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getIdToken: async () => 'expired' });

    await expect(client.get('/health/secure')).rejects.toBeInstanceOf(ApiError);
  });
});
