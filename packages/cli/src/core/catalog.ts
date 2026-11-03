import cooldownSpecials from '@behaviortrees/examples/trees/cooldown-specials.json';
import enemyPatrol from '@behaviortrees/examples/trees/enemy-patrol.json';
import openTheDoor from '@behaviortrees/examples/trees/open-the-door.json';
import robotNavigateRecovery from '@behaviortrees/examples/trees/robot-navigate-recovery.json';
import robotPickAndPlace from '@behaviortrees/examples/trees/robot-pick-and-place.json';
import survivalOverride from '@behaviortrees/examples/trees/survival-override.json';
import { DEFAULT_NODES } from './editor';
import { SITE } from './site';

export type NodeType = {
	name: string;
	category: string;
	title?: string;
	description?: string;
	properties: Record<string, unknown>;
};

// The behavior3 nodes every tree can use without declaring them
export const listNodeTypes = (): NodeType[] =>
	Object.values(DEFAULT_NODES)
		.filter((node) => node.category !== 'root')
		.map((node) => ({
			name: node.name,
			category: node.category,
			title: node.title,
			description: node.description,
			properties: node.properties ?? {},
		}));

type ExampleTree = { id: string; title: string; description: string };

// Every file in packages/examples/trees (a test keeps this list complete)
export const EXAMPLE_TREES: Record<string, unknown>[] = [
	cooldownSpecials,
	enemyPatrol,
	openTheDoor,
	robotNavigateRecovery,
	robotPickAndPlace,
	survivalOverride,
];

export const listExamples = () =>
	(EXAMPLE_TREES as ExampleTree[]).map(({ id, title, description }) => ({
		id,
		title,
		description,
		editorUrl: `${SITE}/?example=${id}`,
	}));

export const getExample = (id: string): Record<string, unknown> | undefined =>
	EXAMPLE_TREES.find((tree) => tree.id === id);
