export const SITE = 'https://www.behaviortrees.com';

const modules = import.meta.glob('../pages/learn/*.md', { eager: true });
const sources = import.meta.glob('../pages/learn/*.md', { eager: true, query: '?raw', import: 'default' });

const slugOf = (path) => path.split('/').pop().replace(/\.md$/, '');

// Drafts build (so they can be previewed at their URL) but stay unlisted
// everywhere else until draft: true is removed.
export const guides = Object.entries(modules)
    .map(([path, module]) => ({
        slug: slugOf(path),
        path: `/learn/${slugOf(path)}/`,
        url: `${SITE}/learn/${slugOf(path)}/`,
        markdownUrl: `${SITE}/learn/${slugOf(path)}.md`,
        frontmatter: module.frontmatter,
        source: sources[path],
    }))
    .filter((guide) => !guide.frontmatter.draft)
    .sort((a, b) => (a.frontmatter.order ?? 99) - (b.frontmatter.order ?? 99));

export const sections = [
    {
        title: 'Foundations',
        description: 'Start with the mental model and the building blocks.',
        guides: guides.filter((guide) => guide.frontmatter.order <= 4),
    },
    {
        title: 'Tools & platforms',
        description: 'Choose an approach for the engine or runtime you use.',
        guides: guides.filter((guide) => guide.frontmatter.order > 4 && guide.frontmatter.order <= 10),
    },
    {
        title: 'Practice & production',
        description: 'Build, debug, and scale trees that hold up in real projects.',
        guides: guides.filter((guide) => guide.frontmatter.order > 10),
    },
].filter((section) => section.guides.length);

const exampleModules = import.meta.glob('../../../../packages/examples/trees/*.json', { eager: true, import: 'default' });

export const examples = Object.values(exampleModules)
    .map((tree) => ({
        id: tree.id,
        title: tree.title,
        description: tree.description,
        url: `${SITE}/?example=${tree.id}`,
        jsonUrl: `${SITE}/examples/${tree.id}.json`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

// The guide's Markdown source with frontmatter dropped and site-relative links
// made absolute, so the text stands on its own outside the site.
export const guideMarkdown = (guide) => {
    const body = guide.source.replace(/^---\n[\s\S]*?\n---\n+/, '');
    const linked = body.replace(/\]\(\//g, `](${SITE}/`);
    const { description, updatedDate, pubDate } = guide.frontmatter;
    const meta = [`> ${description}`, '>', `> Source: ${guide.url}`];
    if (updatedDate || pubDate) meta.push(`> Updated: ${updatedDate ?? pubDate}`);
    const [heading, ...rest] = linked.split('\n');
    return heading.startsWith('# ')
        ? [heading, '', ...meta, ...rest].join('\n')
        : [`# ${guide.frontmatter.title}`, '', ...meta, '', linked].join('\n');
};
