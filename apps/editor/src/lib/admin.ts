// Controls nav visibility only — the server enforces its own allowlist.
const ADMIN_IDS = (import.meta.env.VITE_ADMIN_USER_IDS ?? '')
  .split(',')
  .map((id: string) => id.trim())
  .filter(Boolean);

export function isAdminUser(userId: string | null | undefined): boolean {
  return Boolean(userId && ADMIN_IDS.includes(userId));
}
