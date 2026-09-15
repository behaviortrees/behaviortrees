const PrivacyPage: React.FC = () => (
  <article className="mx-auto max-w-3xl">
    <div className="kicker mb-3 text-accent-soft">Privacy</div>
    <h1 className="text-4xl font-medium tracking-[-0.02em]">Privacy notice</h1>
    <p className="mt-4 text-sm text-faint">Last updated July 28, 2026</p>

    <div className="mt-10 space-y-8 text-muted">
      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Projects</h2>
        <p>
          Anonymous projects stay in your browser. If you sign in, project data is stored
          in our cloud database so it can sync across your devices.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Product analytics</h2>
        <p>
          We use PostHog for aggregate website traffic, product events, retention,
          feedback surveys, and masked session replay. PostHog stores a
          first-party identifier in local storage so we can understand repeat usage. We
          do not intentionally send project names, node names, tree contents, email
          addresses, or free-form project data in product events.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Accounts</h2>
        <p>
          Clerk provides authentication. When you sign in, we use your Clerk user ID to
          associate cloud projects with your account. Your account name and email may be
          used for account administration and support.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Early-access requests</h2>
        <p>
          If you request Pro, Team, or integration access, we store your email, selected
          runtime, team size, production obstacle, and any details you voluntarily
          provide. We use this information to evaluate demand and contact you about your
          request. We do not sell this information.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Your choices</h2>
        <p>
          You can use the editor without an account. Clearing this site&apos;s browser
          storage removes local projects and the anonymous analytics identifier from that
          browser. To request access, correction, or deletion of information associated
          with your account or early-access request, use the Feedback button in the
          application.
        </p>
      </section>
    </div>
  </article>
);

export default PrivacyPage;
