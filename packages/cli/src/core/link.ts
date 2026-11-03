import { toB3 } from './convert';
import { encodeSharedTree } from './editor';
import { loadInput, type TreeInput } from './load';
import { SITE } from './site';
import { validateTree, type Finding } from './validate';

export type EditorLink = { url: string; title: string; findings: Finding[] };

// Chat apps and some browsers truncate URLs around here
export const LONG_LINK = 30_000;

export class InvalidTreeError extends Error {
	constructor(readonly findings: Finding[]) {
		super(
			`The tree has errors:\n${findings
				.filter((finding) => finding.level === 'error')
				.map((finding) => `- ${finding.tree ? `${finding.tree}: ` : ''}${finding.message}`)
				.join('\n')}`,
		);
	}
}

// A link that opens the tree in the editor at behaviortrees.com. The tree
// rides in the URL fragment (zlib + base64url), so it never reaches a server.
export async function createEditorLink(input: TreeInput): Promise<EditorLink> {
	const validation = await validateTree(input);
	if (!validation.valid) throw new InvalidTreeError(validation.findings);
	const loaded = await loadInput(input);
	// behavior3 input goes as written (the editor lays out trees without
	// positions); BT.CPP input goes as the editor's behavior3 export
	const data = loaded.format === 'behavior3' ? loaded.json : toB3(loaded);
	const url = `${SITE}/editor#tree=${await encodeSharedTree(data)}`;
	const findings = [...validation.findings];
	if (url.length > LONG_LINK) {
		findings.push({
			level: 'warning',
			message: `The link is ${url.length.toLocaleString('en-US')} characters; some apps cut off long links, so also share the file`,
		});
	}
	return { url, title: validation.trees.map((tree) => tree.title).join(', '), findings };
}
