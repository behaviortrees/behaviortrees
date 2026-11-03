import { SITE, examples, sections } from '../lib/guides.js';

const MINIMAL_TREE = {
    title: 'Guard',
    root: 'a',
    nodes: {
        a: { name: 'Priority', children: ['b', 'c'] },
        b: { name: 'Sequence', children: ['d', 'e'] },
        c: { name: 'Patrol' },
        d: { name: 'IsEnemyVisible' },
        e: { name: 'Attack' },
    },
    custom_nodes: [
        { name: 'IsEnemyVisible', category: 'condition' },
        { name: 'Attack', category: 'action' },
        { name: 'Patrol', category: 'action' },
    ],
};

// Keep in sync with apps/editor/src/lib/share-link.ts
const SHARE_LINKS = [
    '## Open a tree in the editor from a link',
    '',
    `To give someone a behavior tree they can see and edit, link to ${SITE}/editor#tree=<payload>. It opens in a "Shared trees" project in their browser, with no account needed. The payload stays in the URL fragment, so it is never sent to the server.`,
    '',
    'The payload is a behavior3 JSON tree (or a whole project file), in one of two encodings:',
    '',
    '- URL-encoded JSON (encodeURIComponent). Good for small trees written by hand.',
    '- base64url, without padding, of the zlib-compressed JSON. Use this for anything larger. Python: `base64.urlsafe_b64encode(zlib.compress(json.dumps(tree).encode())).rstrip(b"=").decode()`. Node: `zlib.deflateSync(JSON.stringify(tree)).toString("base64url")`.',
    '',
    'A minimal tree. Node positions are optional: a tree without a "display" field is laid out automatically. Composites list their "children" in order, decorators have one "child", and the rest are leaves.',
    '',
    '```json',
    JSON.stringify(MINIMAL_TREE, null, 2),
    '```',
    '',
    `As a link: ${SITE}/editor#tree=${encodeURIComponent(JSON.stringify(MINIMAL_TREE))}`,
    '',
    'Built-in nodes: composites Sequence, Priority (a selector, also called fallback), MemSequence and MemPriority; decorators Inverter, Repeater, RepeatUntilFailure, RepeatUntilSuccess, MaxTime and Limiter; leaves Succeeder, Failer, Runner, Error and Wait. Declare any other node in "custom_nodes" with a category of action, condition, composite or decorator, plus optional "title", "description" and "properties".',
];

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
        '',
        ...SHARE_LINKS,
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
