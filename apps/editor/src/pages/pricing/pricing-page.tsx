import { useEffect, useState } from 'react';
import { Check, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import InterestDialog from '../../components/commercial/interest-dialog';
import { Button } from '../../components/ui/button';
import { CLOUD_ENABLED } from '../../lib/auth';
import { track } from '../../lib/analytics';
import { hasActivatedProject } from '../../lib/product-metrics';

type PricingContentProps = {
  initialEmail?: string;
};

const INTEGRATION_FEATURES = [
  'Unity or proprietary runtimes',
  'BehaviorTree.CPP / ROS 2',
  'Custom import and export formats',
  'Migration and onboarding',
];

const PricingContent: React.FC<PricingContentProps> = ({ initialEmail }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    track('pricing_viewed', { activated_before_view: hasActivatedProject() });
  }, []);

  const openInterest = () => {
    track('pricing_cta_clicked', { plan: 'integration', placement: 'pricing_card' });
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <InterestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan="integration"
        initialEmail={initialEmail}
      />

      <div className="mx-auto mb-10 max-w-3xl text-center">
        <div className="kicker mb-3 text-accent-soft">Pricing</div>
        <h1 className="text-4xl font-medium tracking-[-0.02em]">Free to use</h1>
        <p className="mt-4 text-lg text-muted">
          The editor is free and open source. If you need it wired into your engine or
          runtime, we can build that for you.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="card flex flex-col">
          <div>
            <h2 className="text-2xl font-medium">Free</h2>
            <p className="mt-2 text-lg">$0</p>
            <p className="mt-3 text-sm text-muted">
              Everything needed to design and export behavior trees.
            </p>
          </div>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-muted">
            {[
              'Local projects with no account',
              'Basic cloud sync',
              'Behavior3 JSON import and export',
              'Examples and learning guides',
            ].map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft" />
                {feature}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-8 w-full">
            <Link to="/editor">Open editor</Link>
          </Button>
        </div>

        <div className="card flex flex-col">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-medium">Custom integration</h2>
              <Wrench className="h-5 w-5 text-accent-soft" />
            </div>
            <p className="mt-2 text-lg">From $2,500</p>
            <p className="mt-3 text-sm text-muted">
              Connect Behavior Trees to your production stack.
            </p>
          </div>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-muted">
            {INTEGRATION_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft" />
                {feature}
              </li>
            ))}
          </ul>
          <Button className="mt-8 w-full" onClick={openInterest}>
            Discuss an integration
          </Button>
        </div>
      </div>
    </div>
  );
};

const PricingWithAuth: React.FC = () => {
  const { user } = useUser();
  return (
    <PricingContent initialEmail={user?.primaryEmailAddress?.emailAddress ?? ''} />
  );
};

const PricingPage: React.FC = () =>
  CLOUD_ENABLED ? <PricingWithAuth /> : <PricingContent />;

export default PricingPage;
