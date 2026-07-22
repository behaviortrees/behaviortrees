import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { startCloudSync, stopCloudSync } from '../../lib/storage/cloud-sync';

// Bridges the Clerk session to the (non-React) sync engine. Rendered only
// inside ClerkProvider, so it must live behind the CLOUD_ENABLED gate.
const CloudSyncController: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      // Fetch the token at request time so it is always fresh
      startCloudSync(() => getToken());
      return () => stopCloudSync();
    }
    stopCloudSync();
  }, [isLoaded, isSignedIn, getToken]);

  return null;
};

export default CloudSyncController;
