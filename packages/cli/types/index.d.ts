export type TreeInput = string | Record<string, unknown> | unknown[];

export type Finding = { level: 'error' | 'warning' | 'info'; message: string; tree?: string };

export type ValidationResult = {
	valid: boolean;
	format?: 'behavior3' | 'btcpp';
	kind?: 'tree' | 'project';
	trees: { title: string; nodes: number }[];
	findings: Finding[];
};
export declare function validateTree(input: TreeInput): Promise<ValidationResult>;

export type ConvertTarget = 'behavior3' | 'btcpp-v4' | 'btcpp-v3';
export declare const CONVERT_TARGETS: ConvertTarget[];
export type ConvertResult = { output: string; format: ConvertTarget; issues: Finding[] };
export declare function convertTree(input: TreeInput, to: ConvertTarget): Promise<ConvertResult>;

export type EditorLink = { url: string; title: string; findings: Finding[] };
export declare class InvalidTreeError extends Error {
	readonly findings: Finding[];
}
export declare function createEditorLink(input: TreeInput): Promise<EditorLink>;

export type NodeType = {
	name: string;
	category: string;
	title?: string;
	description?: string;
	properties: Record<string, unknown>;
};
export declare function listNodeTypes(): NodeType[];
export declare function listExamples(): { id: string; title: string; description: string; editorUrl: string }[];
export declare function getExample(id: string): Record<string, unknown> | undefined;

export type Guide = { slug: string; title: string; description: string; url: string; markdownUrl: string };
export declare function listGuides(): Promise<Guide[]>;
export declare function readGuide(slug: string): Promise<string>;
