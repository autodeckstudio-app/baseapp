/** Google iOS OAuth requires the registered client's reversed-ID callback scheme. */
export function googleIosRedirectUri(clientId: string | undefined): string | undefined {
  if (!clientId || !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId)) return undefined;
  return `${clientId.split(".").reverse().join(".")}:/oauthredirect`;
}
