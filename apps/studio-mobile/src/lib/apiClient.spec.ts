import { createStudioApiClient, type AuthLike } from './apiClient';

function mockFetchResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: jest.fn().mockResolvedValue(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

describe('createStudioApiClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("attaches the current Firebase user's ID token to requests", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(200, { ok: true }));
    const auth: AuthLike = { currentUser: { getIdToken: jest.fn().mockResolvedValue('id-token-abc') }, signOut: jest.fn() };
    const client = createStudioApiClient(auth);

    await client.get('/health/secure');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer id-token-abc');
  });

  it('sends no Authorization header when signed out', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(200, { ok: true }));
    const auth: AuthLike = { currentUser: null, signOut: jest.fn() };
    const client = createStudioApiClient(auth);

    await client.get('/health');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it('signs the user out when the backend responds 401', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(401, { message: 'Authentication failed' }));
    const signOut = jest.fn().mockResolvedValue(undefined);
    const auth: AuthLike = { currentUser: { getIdToken: jest.fn().mockResolvedValue('stale-token') }, signOut };
    const client = createStudioApiClient(auth);

    await expect(client.get('/staff')).rejects.toThrow();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('does not sign the user out on a non-401 error', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(403, { message: 'Forbidden' }));
    const signOut = jest.fn();
    const auth: AuthLike = { currentUser: { getIdToken: jest.fn().mockResolvedValue('token') }, signOut };
    const client = createStudioApiClient(auth);

    await expect(client.get('/staff')).rejects.toThrow();
    expect(signOut).not.toHaveBeenCalled();
  });
});
