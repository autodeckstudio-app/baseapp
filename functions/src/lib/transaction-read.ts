/** The emulator reports an invalidated transaction ID differently from production.
 * Normalize only that read failure to ABORTED so the SDK uses its existing bounded
 * transaction retries. Never retry an outer cancellation or a provider operation.
 */
export async function transactionRead<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    const failure = error as { code?: unknown; details?: unknown };
    if (failure?.code === 3 && failure.details === "Transaction is invalid or closed.") {
      throw Object.assign(new Error("Transaction read was invalidated.", { cause: error }), { code: 10 });
    }
    throw error;
  }
}
