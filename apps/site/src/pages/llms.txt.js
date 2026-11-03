import { SITE, examples, sections } from '../lib/guides.js';

// https://llmstxt.org: a short index of the site for LLMs and agents
const body = () => {
    const lines = [
        '# behaviortrees.com',
        '',
        '> A free, open source online visual editor for behavior trees, used for game AI and robotics, plus practical guides to behavior trees. No account needed: projects save in the browser, with optional sign-in to sync them.',
        '',
        'The editor imports and exports behavior3 JSON, including custom node definitions, and BehaviorTree.CPP XML (v3 and v4, as used by Groot2 and ROS 2 Nav2). It runs entirely in the browser; there is no public API.',
        '',
        '## Editor',
        '',
        `- [Behavior Tree Editor](${SITE}/): what the editor does, with a live example`,
        `- [Open the editor](${SITE}/editor): create a project and start editing (requires JavaScript)`,
        `- [Pricing](${SITE}/pricing): the editor is free; paid custom integrations are available`,
        `- [Changelog](${SITE}/changelog): recent changes`,
        '- [Source code](https://github.com/behaviortrees/behaviortrees): AGPL-3.0, issues and contributions welcome',
        '',
        '## Example trees',
        '',
        'Each link opens the tree in the editor. The behavior3 JSON is at the linked .json URL.',
        '',
        ...examples.map((example) => `- [${example.title}](${example.url}): ${example.description} JSON: ${example.jsonUrl}`),
    ];
    for (const section of sections) {
        lines.push('', `## Guides: ${section.title}`, '');
        for (const guide of section.guides) {
            lines.push(`- [${guide.frontmatter.title}](${guide.markdownUrl}): ${guide.frontmatter.description}`);
        }
    }
    lines.push('', '## Optional', '', '- [Classic editor](https://old.behaviortrees.com): the original behavior3 editor (AngularJS)');
    return `${lines.join('\n')}\n`;
};

export const GET = () =>
    new Response(body(), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
