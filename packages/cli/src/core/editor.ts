// The editor's tree code, bundled into this package at build time: the CLI and
// MCP server read, check and write trees exactly the way the editor does.
export { DEFAULT_NODES } from '../../../../apps/editor/src/lib/behavior/defaults';
export {
	b3ToProject,
	parseImportedJson,
	projectToB3,
	treeToB3,
	type B3NodeSpec,
	type B3NodeTemplate,
	type B3Project,
	type B3Tree,
} from '../../../../apps/editor/src/lib/behavior/b3';
export {
	btcppToProject,
	isLikelyXml,
	parseBtcppXml,
	projectToBtcpp,
	treeToBtcpp,
	type BtcppIssue,
} from '../../../../apps/editor/src/lib/behavior/btcpp';
export { InvalidFileError } from '../../../../apps/editor/src/lib/behavior/import-error';
export { encodeSharedTree } from '../../../../apps/editor/src/lib/share-link';
export type { Node, NodeCategory, Project } from '../../../../apps/editor/src/types';
