const PrivacyPage: React.FC = () => (
  <article className="mx-auto max-w-3xl">
    <div className="kicker mb-3 text-accent-soft">Privacy</div>
    <h1 className="text-4xl font-medium tracking-[-0.02em]">Privacy notice</h1>
    <p className="mt-4 text-sm text-faint">Last updated November 3, 2026</p>

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
        <h2 className="mb-2 text-xl font-medium text-fg">Shared tree links</h2>
        <p>
          A link made with Copy link carries the tree inside the part of the URL after
          the #, which browsers don&apos;t send to servers. Opening one loads the tree in
          your browser and removes it from the address bar. We don&apos;t receive or store
          the tree, and it isn&apos;t sent to analytics.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">MCP server and command-line tool</h2>
        <p>
          The MCP server at www.behaviortrees.com/mcp, used by AI assistants, handles each
          request in memory to run the requested tool and return its result. It requires
          no account, sets no cookies, and doesn&apos;t store the trees or other inputs it
          receives. Our hosting provider keeps standard request logs, such as IP address,
          time and path, for a limited period to operate the service. The behaviortrees
          command-line tool runs on your computer and only contacts this site when you
          ask it for guides.
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
          application or open an issue at github.com/behaviortrees/behaviortrees.
        </p>
      </section>
    </div>
  </article>
);

export default PrivacyPage;
