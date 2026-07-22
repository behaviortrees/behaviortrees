import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { identifyUser, resetUser } from '../../lib/analytics';
import { startCloudSync, stopCloudSync } from '../../lib/storage/cloud-sync';

// Bridges the Clerk session to the (non-React) sync engine. Rendered only
// inside ClerkProvider, so it must live behind the CLOUD_ENABLED gate.
const CloudSyncController: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      // Fetch the token at request time so it is always fresh
      startCloudSync(() => getToken());
      return () => stopCloudSync();
    }
    stopCloudSync();
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      identifyUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
      });
    } else {
      resetUser();
    }
  }, [isLoaded, user]);

  return null;
};

export default CloudSyncController;
