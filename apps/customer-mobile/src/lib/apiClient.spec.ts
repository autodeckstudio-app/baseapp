import { createCustomerApiClient, type AuthLike } from './apiClient';

function mockFetchResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: jest.fn().mockResolvedValue(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

describe('createCustomerApiClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("attaches the current Firebase user's ID token to requests", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(200, { ok: true }));
    const auth: AuthLike = { currentUser: { getIdToken: jest.fn().mockResolvedValue('id-token-abc') }, signOut: jest.fn() };
    const client = createCustomerApiClient(auth);

    await client.get('/health');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer id-token-abc');
  });

  it('sends no Authorization header when signed out', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(200, { ok: true }));
    const auth: AuthLike = { currentUser: null, signOut: jest.fn() };
    const client = createCustomerApiClient(auth);

    await client.get('/health');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('signs the user out when the backend responds 401', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(401, { message: 'Authentication failed' }));
    const signOut = jest.fn().mockResolvedValue(undefined);
    const auth: AuthLike = { currentUser: { getIdToken: jest.fn().mockResolvedValue('stale-token') }, signOut };
    const client = createCustomerApiClient(auth);

    await expect(client.get('/health/secure')).rejects.toThrow();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
