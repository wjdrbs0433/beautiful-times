export const AUTH_STORAGE_KEY = 'bt.supabase.auth.v1';
export const ACTIVITY_STORAGE_KEY = 'bt.auth.last-active.v1';
export const IDLE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
type Storage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};

// Device-local idle policy. Token refreshes must never count as app usage.
export function idleSessionStorage(base: Storage, now: () => number = Date.now) {
  let expired = false;
  async function expiredOnRead() {
    const raw = await base.getItem(ACTIVITY_STORAGE_KEY);
    if (raw === null) return false; // Adopt an existing installation on first use.
    const time = Number(raw);
    return !Number.isFinite(time) || time <= 0 || now() - time >= IDLE_TIMEOUT_MS;
  }
  const storage: Storage = {
    async getItem(key) {
      if (key === AUTH_STORAGE_KEY && await expiredOnRead()) {
        // Remove credentials only; account-specific memories remain untouched.
        await base.removeItem(AUTH_STORAGE_KEY);
        await base.removeItem(AUTH_STORAGE_KEY + '-user');
        await base.removeItem(ACTIVITY_STORAGE_KEY);
        expired = true;
        return null;
      }
      return base.getItem(key);
    },
    async setItem(key, value) {
      await base.setItem(key, value);
      if (key === AUTH_STORAGE_KEY && await base.getItem(ACTIVITY_STORAGE_KEY) === null)
        await base.setItem(ACTIVITY_STORAGE_KEY, String(now()));
    },
    async removeItem(key) {
      await base.removeItem(key);
      if (key === AUTH_STORAGE_KEY) await base.removeItem(ACTIVITY_STORAGE_KEY);
    },
  };
  return {
    storage,
    async markActive() {
      if (await storage.getItem(AUTH_STORAGE_KEY))
        await base.setItem(ACTIVITY_STORAGE_KEY, String(now()));
    },
    takeExpired() { const value = expired; expired = false; return value; },
    // Only exposed to a __DEV__-guarded test control; production uses 30 days.
    async simulate31DaysInactive() {
      await base.setItem(ACTIVITY_STORAGE_KEY, String(now() - 31 * 24 * 60 * 60 * 1000));
    },
  };
}
