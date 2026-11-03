const TermsPage: React.FC = () => (
  <article className="mx-auto max-w-3xl">
    <div className="kicker mb-3 text-accent-soft">Terms</div>
    <h1 className="text-4xl font-medium tracking-[-0.02em]">Terms of service</h1>
    <p className="mt-4 text-sm text-faint">Last updated November 3, 2026</p>

    <div className="mt-10 space-y-8 text-muted">
      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">What these terms cover</h2>
        <p>
          These terms apply to behaviortrees.com: the behavior tree editor, the guides at
          /learn, shared tree links, the MCP server at www.behaviortrees.com/mcp, and the
          behaviortrees command-line tool. By using any of them, you agree to these terms.
          How we handle data is described in the{' '}
          <a href="/privacy" className="text-accent-soft hover:underline">
            privacy notice
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Your trees</h2>
        <p>
          Trees and projects you create are yours. Anonymous projects stay in your browser;
          if you sign in, we store your projects so they can sync across your devices. A
          shared link contains the whole tree, so anyone you give the link to can open it.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Open source</h2>
        <p>
          The editor and the behaviortrees command-line tool are open source under the
          AGPL-3.0 license, with portions under the MIT license, at
          github.com/behaviortrees/behaviortrees. Nothing in these terms limits the rights
          those licenses give you.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Acceptable use</h2>
        <p>
          Don&apos;t use the service to break the law, and don&apos;t try to disrupt it,
          overload it with automated requests, or get around its security. We may limit or
          block access that does.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">AI assistants and the MCP server</h2>
        <p>
          The MCP server validates and converts trees and returns links, examples and
          guides. Its results, and anything an AI assistant writes using them, can contain
          mistakes. Review a tree before relying on it, and test it safely before running
          it on a robot or other physical system. Answers from an AI assistant are produced
          by that assistant, not by us.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">No warranty</h2>
        <p>
          The service is provided as is and as available, without warranties of any kind.
          To the extent the law allows, we aren&apos;t liable for indirect, incidental or
          consequential damages, or for lost data, arising from your use of the service.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Changes</h2>
        <p>
          We may change or discontinue parts of the service, and we may update these terms.
          The date at the top shows when they last changed. Custom integration work is
          covered by a separate agreement.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-medium text-fg">Contact</h2>
        <p>
          Questions about these terms: use the Feedback button in the application or open
          an issue at github.com/behaviortrees/behaviortrees.
        </p>
      </section>
    </div>
  </article>
);

export default TermsPage;
