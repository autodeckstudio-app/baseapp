/** Latest request wins. Invalidating on close/account change prevents stale updates. */
export function createStoryRefreshGate() {
  let epoch = 0;
  let activeScope: string | null = null;
  return {
    begin(scope: string) {
      activeScope = scope;
      const currentEpoch = ++epoch;
      return { current: () => epoch === currentEpoch && activeScope === scope };
    },
    invalidate() { ++epoch; activeScope = null; },
  };
}
