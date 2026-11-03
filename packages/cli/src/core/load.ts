import {
	b3ToProject,
	btcppToProject,
	DEFAULT_NODES,
	InvalidFileError,
	isLikelyXml,
	parseBtcppXml,
	parseImportedJson,
	type B3Tree,
	type BtcppIssue,
	type Project,
} from './editor';
import { ensureDomParser } from './xml-dom';

// A tree or project as the user gave it, plus the editor's model of it
export type Loaded = {
	format: 'behavior3' | 'btcpp';
	kind: 'tree' | 'project';
	project: Project;
	// behavior3 input as written, for structural checks the import would
	// otherwise smooth over (legacy project files have none)
	b3Trees: B3Tree[];
	// The parsed JSON, for links (behavior3 input only)
	json?: unknown;
	btcppVersion?: 3 | 4;
	issues: BtcppIssue[];
};

export type TreeInput = string | Record<string, unknown> | unknown[];

export async function loadInput(input: TreeInput): Promise<Loaded> {
	if (typeof input === 'string' && isLikelyXml(input.trim())) {
		await ensureDomParser();
		const parsed = parseBtcppXml(input.trim(), { ...DEFAULT_NODES }, 'horizontal');
		if (parsed.kind === 'nodes') {
			throw new InvalidFileError('This BehaviorTree.CPP file only defines node models, with no trees', 'not_behavior_tree');
		}
		const project = btcppToProject(parsed, 'Imported project');
		return {
			format: 'btcpp',
			kind: parsed.trees.length === 1 ? 'tree' : 'project',
			project,
			b3Trees: [],
			btcppVersion: parsed.version,
			issues: parsed.issues,
		};
	}

	let json: unknown = input;
	if (typeof input === 'string') {
		try {
			json = JSON.parse(input.trim());
		} catch (error) {
			throw new InvalidFileError(`Not valid JSON or XML: ${(error as Error).message}`, 'not_behavior_tree');
		}
	}

	const imported = parseImportedJson(json);
	if (imported.kind === 'nodes') {
		throw new InvalidFileError('This file only defines custom nodes, with no trees', 'not_behavior_tree');
	}
	if (imported.kind === 'tree') {
		const tree = imported.tree;
		const project = b3ToProject({ name: tree.title, trees: [tree], custom_nodes: tree.custom_nodes });
		return { format: 'behavior3', kind: 'tree', project, b3Trees: [tree], json, issues: [] };
	}
	const raw = json as { trees?: unknown };
	const b3Trees = Array.isArray(raw.trees) ? (raw.trees as B3Tree[]) : [];
	return { format: 'behavior3', kind: 'project', project: imported.project, b3Trees, json, issues: [] };
}
