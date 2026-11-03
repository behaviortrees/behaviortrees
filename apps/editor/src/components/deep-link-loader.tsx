import { useEffect, useRef } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useProjectStore } from '../stores/useProjectStore';
import { b3ToProject, b3ToTree, ImportedData, parseImportedJson } from '../lib/behavior/b3';
import { ProjectOrigin, track } from '../lib/analytics';
import { setProjectOrigin } from '../lib/product-metrics';
import { consumePendingSharedTree, decodeSharedTree, takeSharedTreeFromUrl } from '../lib/share-link';

// Deep links that open a tree in a stable project, mirroring the classic
// editor's example loading:
//   /?example=enemy-patrol  fetches /examples/enemy-patrol.json into "Examples"
//   /editor#tree=<payload>  opens a shared tree (lib/share-link.ts) in "Shared trees"

type StableProject = { id: string; name: string; description: string; origin: ProjectOrigin };

const EXAMPLES: StableProject = {
	id: 'examples',
	name: 'Examples',
	description: 'Example trees from the behaviortrees.com guides',
	origin: 'guide_example',
};

const SHARED: StableProject = {
	id: 'shared',
	name: 'Shared trees',
	description: 'Trees opened from shared links',
	origin: 'shared_link',
};

// Reuse the project if it exists, otherwise create it
const switchToProject = ({ id, name, description }: StableProject) => {
	const store = useProjectStore.getState();
	if (store.project?.id === id) return;
	const raw = localStorage.getItem(`bt-project-${id}`);
	if (raw) {
		try {
			const parsed = parseImportedJson(JSON.parse(raw));
			if (parsed.kind === 'project') {
				store.loadProject(parsed.project);
				return;
			}
		} catch {
			// fall through to a fresh project
		}
	}
	store.loadProject(b3ToProject({ id, name, description, trees: [] }));
};

// The classic editor branches on data.trees: project files merge their custom
// nodes and every tree into the open project, tree files import as a single
// tree (app.js:68-72, ImportManager.js:4-14). Returns a label for the toast.
const importIntoProject = (imported: ImportedData, target: StableProject): string => {
	if (imported.kind === 'nodes') throw new Error('not a tree or project file');
	switchToProject(target);
	const current = useProjectStore.getState();
	let label: string;

	if (imported.kind === 'project') {
		const trees = Object.values(imported.project.trees);
		if (trees.length === 0) throw new Error('project has no trees');

		current.addNodes(imported.project.nodes);
		trees.forEach((tree) => current.addImportedTree(tree, {}));

		const selected = imported.project.selectedTreeId;
		if (selected && imported.project.trees[selected]) {
			current.selectTree(selected);
		}
		label = imported.project.name;
	} else {
		const { tree, nodes } = b3ToTree(imported.tree, current.project!.nodes);
		current.addImportedTree(tree, nodes);
		label = tree.title;
	}

	useProjectStore.getState().saveProject();
	setProjectOrigin(target.id, target.origin);
	return label;
};

const openShared = async (payload: string, navigate: NavigateFunction) => {
	try {
		const { data, encoding } = await decodeSharedTree(payload);
		const imported = parseImportedJson(data);
		const label = importIntoProject(imported, SHARED);
		navigate('/editor');
		track('shared_link_opened', { kind: imported.kind === 'project' ? 'project' : 'tree', encoding });
		toast.success(`Opened "${label}"`);
	} catch (error) {
		console.error('Failed to open shared tree', error);
		track('shared_link_failed', {});
		toast.error('Could not open the tree in that link');
	}
};

const DeepLinkLoader = () => {
	const navigate = useNavigate();
	const ran = useRef(false);

	// A link pasted into a tab that already has the app open only changes the
	// fragment, so main.tsx's startup check never sees it
	useEffect(() => {
		const onHashChange = () => {
			if (takeSharedTreeFromUrl()) openShared(consumePendingSharedTree()!, navigate);
		};
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	}, [navigate]);

	useEffect(() => {
		if (ran.current) return;
		ran.current = true;

		const shared = consumePendingSharedTree();
		if (shared) {
			openShared(shared, navigate);
			return;
		}

		const match = /[?&]example=([\w-]+)/.exec(window.location.search);
		if (!match) return;
		const name = match[1];

		(async () => {
			try {
				const response = await fetch(`/examples/${name}.json`);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const label = importIntoProject(parseImportedJson(await response.json()), EXAMPLES);

				// Drop the query string and land in the editor
				window.history.replaceState(null, '', '/');
				navigate('/editor');
				track('example_loaded', { example: name });
				toast.success(`Example "${label}" loaded`);
			} catch (error) {
				console.error('Failed to load example', error);
				toast.error('Could not load that example');
			}
		})();
	}, [navigate]);

	return null;
};

export default DeepLinkLoader;
