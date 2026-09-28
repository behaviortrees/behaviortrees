import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import {
  OBSTACLE_OPTIONS,
  RUNTIME_OPTIONS,
  USAGE_OPTIONS,
  submitCommercialInterest,
} from '../../lib/commercial-interest';
import {
  registerAnalyticsProperties,
  track,
  type CommercialPlan,
  type ProductionObstacle,
  type RuntimeSegment,
  type UsageMode,
} from '../../lib/analytics';

type InterestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CommercialPlan;
  initialEmail?: string;
};

const PLAN_LABELS: Record<CommercialPlan, string> = {
  pro: 'Pro early access',
  team: 'Team early access',
  integration: 'Custom integration',
};

const InterestDialog: React.FC<InterestDialogProps> = ({
  open,
  onOpenChange,
  plan,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [runtime, setRuntime] = useState<RuntimeSegment>('evaluating');
  const [usageMode, setUsageMode] = useState<UsageMode>('solo');
  const [obstacle, setObstacle] =
    useState<ProductionObstacle>('runtime_integration');
  const [obstacleDetail, setObstacleDetail] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open && initialEmail) setEmail(initialEmail);
    if (open) {
      setError(null);
      setSubmitted(false);
    }
  }, [open, initialEmail, plan]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !contactConsent) {
      setError('Enter your email and confirm that we may contact you.');
      track('commercial_interest_failed', {
        plan,
        failure_category: 'validation',
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitCommercialInterest({
        email: email.trim(),
        plan,
        runtime,
        usageMode,
        obstacle,
        obstacleDetail: obstacleDetail.trim() || undefined,
        sourcePath: window.location.pathname,
        contactConsent,
        website,
      });
      registerAnalyticsProperties({ runtime_segment: runtime, usage_mode: usageMode });
      track('commercial_interest_submitted', {
        plan,
        runtime,
        usage_mode: usageMode,
        obstacle,
      });
      setSubmitted(true);
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Request failed';
      setError(message);
      track('commercial_interest_failed', {
        plan,
        failure_category:
          submissionError instanceof TypeError ? 'network' : 'server',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        {submitted ? (
          <>
            <DialogHeader>
              <DialogTitle>Request received</DialogTitle>
              <DialogDescription>
                Thanks—we will contact you at {email}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{PLAN_LABELS[plan]}</DialogTitle>
              <DialogDescription>
                Tell us about your runtime and project, and we will follow up.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">What runtime are you targeting?</span>
                <select
                  value={runtime}
                  onChange={(event) => setRuntime(event.target.value as RuntimeSegment)}
                  className="w-full"
                >
                  {RUNTIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Who will use this?</span>
                <select
                  value={usageMode}
                  onChange={(event) => setUsageMode(event.target.value as UsageMode)}
                  className="w-full"
                >
                  {USAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  What is your biggest production obstacle?
                </span>
                <select
                  value={obstacle}
                  onChange={(event) =>
                    setObstacle(event.target.value as ProductionObstacle)
                  }
                  className="w-full"
                >
                  {OBSTACLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  Anything else we should know? <span className="text-faint">(optional)</span>
                </span>
                <textarea
                  value={obstacleDetail}
                  onChange={(event) => setObstacleDetail(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Your workflow, file format, engine version, or current workaround"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>

              <label className="hidden" aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>

              <label className="flex items-start gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={(event) => setContactConsent(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  You may contact me about this request and early access. See the{' '}
                  <a href="/privacy" className="text-accent-soft hover:underline">
                    privacy notice
                  </a>
                  .
                </span>
              </label>

              {error && (
                <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-soft">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Request access'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InterestDialog;
