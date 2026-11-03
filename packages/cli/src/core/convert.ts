import { projectToB3, projectToBtcpp, treeToB3, treeToBtcpp } from './editor';
import { loadInput, type Loaded, type TreeInput } from './load';
import type { Finding } from './validate';

export type ConvertTarget = 'behavior3' | 'btcpp-v4' | 'btcpp-v3';
export const CONVERT_TARGETS: ConvertTarget[] = ['behavior3', 'btcpp-v4', 'btcpp-v3'];

export type ConvertResult = { output: string; format: ConvertTarget; issues: Finding[] };

// behavior3 JSON for a loaded tree or project, as the editor exports it
export const toB3 = (loaded: Loaded): unknown => {
	const { project } = loaded;
	const trees = Object.values(project.trees);
	return loaded.kind === 'tree' && trees.length === 1 ? treeToB3(trees[0], project, true) : projectToB3(project);
};

export async function convertTree(input: TreeInput, to: ConvertTarget): Promise<ConvertResult> {
	const loaded = await loadInput(input);
	const issues: Finding[] = loaded.issues.map((issue) => ({ level: issue.level, message: issue.message }));

	if (to === 'behavior3') {
		return { output: `${JSON.stringify(toB3(loaded), null, 2)}\n`, format: to, issues };
	}

	const options = { version: to === 'btcpp-v3' ? 3 : 4, layout: 'horizontal' } as const;
	const { project } = loaded;
	const trees = Object.values(project.trees);
	const result =
		loaded.kind === 'tree' && trees.length === 1
			? treeToBtcpp(project, trees[0].id, options)
			: projectToBtcpp(project, options);
	issues.push(...result.issues.map((issue) => ({ level: issue.level, message: issue.message })));
	return { output: result.xml.endsWith('\n') ? result.xml : `${result.xml}\n`, format: to, issues };
}
