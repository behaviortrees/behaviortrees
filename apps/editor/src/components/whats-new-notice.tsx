import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { track } from '../lib/analytics';
import { LATEST_RELEASE, markWhatsNewSeen, shouldShowWhatsNew } from '../lib/changelog';

// One-time toast for returning users after a release. Shown once, then
// marked seen whether or not they click through.
const WhatsNewNotice: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!shouldShowWhatsNew()) return;
    markWhatsNewSeen();
    // Already reading it
    if (pathname === '/changelog') return;

    const release = LATEST_RELEASE.id;
    track('whats_new_shown', { release });
    let clicked = false;
    toast(`New: ${LATEST_RELEASE.title}`, {
      id: 'whats-new',
      description: LATEST_RELEASE.summary,
      duration: 20000,
      closeButton: true,
      action: {
        label: "See what's new",
        onClick: () => {
          clicked = true;
          track('whats_new_clicked', { release, placement: 'notice' });
          navigate('/changelog');
        },
      },
      onDismiss: () => {
        if (!clicked) track('whats_new_dismissed', { release });
      },
    });
  }, [navigate, pathname]);

  return null;
};

export default WhatsNewNotice;
