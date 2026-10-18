import React from 'react';
import { Link } from 'react-router-dom';
import { CHANGELOG, ChangeKind } from '../../lib/changelog';
import { cn } from '../../lib/utils';

const KIND_LABEL: Record<ChangeKind, string> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
};

const KIND_CLASS: Record<ChangeKind, string> = {
  new: 'border-accent bg-accent-wash text-accent-soft',
  improved: 'border-border text-fg',
  fixed: 'border-border text-muted',
};

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const ChangelogPage: React.FC = () => (
  <article className="mx-auto max-w-3xl">
    <div className="kicker mb-3 text-accent-soft">Changelog</div>
    <h1 className="text-4xl font-medium tracking-[-0.02em]">What&apos;s new</h1>
    <p className="mt-4 text-muted">
      Recent changes to the behavior tree editor. Have an idea or found a bug? Use the
      Feedback button at the top of the page.
    </p>

    <div className="mt-12 space-y-14">
      {CHANGELOG.map((entry) => (
        <section key={entry.id} aria-labelledby={`release-${entry.id}`}>
          <time dateTime={entry.date} className="text-sm text-faint">
            {formatDate(entry.date)}
          </time>
          <h2 id={`release-${entry.id}`} className="mt-1 text-2xl font-medium text-fg">
            {entry.title}
          </h2>
          <p className="mt-2 text-muted">{entry.summary}</p>
          <ul className="mt-6 space-y-4">
            {entry.changes.map((change) => (
              <li key={change.text} className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 w-[74px] shrink-0 rounded-full border px-2 py-px text-center text-xs font-medium',
                    KIND_CLASS[change.kind]
                  )}
                >
                  {KIND_LABEL[change.kind]}
                </span>
                <span className="text-muted">{change.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>

    <p className="mt-14">
      <Link to="/editor" className="text-accent-soft hover:underline">
        Open the editor →
      </Link>
    </p>
  </article>
);

export default ChangelogPage;
