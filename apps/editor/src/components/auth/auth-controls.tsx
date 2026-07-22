import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react';
import { useSyncStore } from '../../lib/storage/cloud-sync';
import { Button } from '../ui/button';

const SyncIndicator: React.FC = () => {
  const status = useSyncStore((state) => state.status);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);

  if (status === 'idle') return null;

  const views = {
    syncing: { icon: RefreshCw, label: 'Syncing…', spin: true },
    synced: {
      icon: Cloud,
      label: lastSyncedAt
        ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
        : 'Synced',
      spin: false,
    },
    offline: { icon: CloudOff, label: 'Offline — changes saved locally', spin: false },
    error: { icon: CloudAlert, label: 'Sync error — will retry', spin: false },
  } as const;

  const view = views[status];
  const Icon = view.icon;

  return (
    <span className="flex items-center text-muted" title={view.label}>
      <Icon size={15} className={view.spin ? 'animate-spin' : undefined} />
    </span>
  );
};

// Header slot: sign-in button when signed out, avatar + sync status when in.
// Only rendered when cloud features are enabled (inside ClerkProvider).
const AuthControls: React.FC = () => (
  <div className="flex items-center gap-3">
    <SignedOut>
      <SignInButton mode="modal">
        <Button
          size="sm"
          className="h-7 gap-1.5 rounded-full px-3.5 text-[13px]"
          title="Sync your projects across machines"
        >
          <Cloud size={14} />
          Sign in
        </Button>
      </SignInButton>
    </SignedOut>
    <SignedIn>
      <SyncIndicator />
      <UserButton
        appearance={{ elements: { userButtonAvatarBox: 'h-6 w-6' } }}
      />
    </SignedIn>
  </div>
);

export default AuthControls;
