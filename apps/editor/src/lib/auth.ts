// Cloud features (auth + sync) light up only when a Clerk publishable key is
// configured. Without it the app behaves exactly as the local-only editor.
export const CLERK_PUBLISHABLE_KEY: string | undefined = import.meta.env
  .VITE_CLERK_PUBLISHABLE_KEY;

export const CLOUD_ENABLED = Boolean(CLERK_PUBLISHABLE_KEY);
