import React, { useRef, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useProjectStore } from '../../stores/useProjectStore';
import { b3ToTree, parseImportedJson } from '../../lib/behavior/b3';
import { track } from '../../lib/analytics';
import { toast } from 'sonner';
import { ClipboardPaste, FileUp, Workflow } from 'lucide-react';

// Bundled example trees from @behaviortrees/examples, served at /examples
const EXAMPLES = [
	{
		file: 'open-the-door',
		title: 'Open The Door',
		description: 'The classic teaching example: selector vs sequence',
	},
	{
		file: 'enemy-patrol',
		title: 'Enemy Patrol AI',
		description: 'Attack in range, chase when visible, otherwise patrol',
	},
	{
		file: 'robot-pick-and-place',
		title: 'Robot Pick And Place',
		description: 'A robotics-style task with success/failure recovery',
	},
];

type ImportModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const ImportModal: React.FC<ImportModalProps> = ({ open, onOpenChange }) => {
	const [pasted, setPasted] = useState('');
	const [loadingExample, setLoadingExample] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Shared endpoint for every source: paste, file, or example
	const importJson = (json: unknown, source: 'paste' | 'file' | 'example'): boolean => {
		const store = useProjectStore.getState();
		try {
			const imported = parseImportedJson(json);

			if (imported.kind === 'project') {
				store.loadProject(imported.project);
				toast.success('Project imported');
			} else if (imported.kind === 'tree') {
				if (!store.project) {
					toast.error('Open a project before importing a tree');
					return false;
				}
				const { tree, nodes } = b3ToTree(imported.tree, store.project.nodes);
				store.addImportedTree(tree, nodes);
				toast.success(`Tree "${tree.title}" added`);
			} else {
				if (!store.project) {
					toast.error('Open a project before importing nodes');
					return false;
				}
				store.addNodes(imported.nodes);
				toast.success(`${Object.keys(imported.nodes).length} node(s) imported`);
			}
			track('import', { type: imported.kind, source });
			store.saveProject();
			onOpenChange(false);
			return true;
		} catch (error) {
			console.error('Failed to import', error);
			toast.error('Not a valid behavior tree JSON');
			return false;
		}
	};

	const handlePasteImport = () => {
		try {
			const json = JSON.parse(pasted);
			if (importJson(json, 'paste')) setPasted('');
		} catch {
			toast.error('Not valid JSON — check the pasted text');
		}
	};

	const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				importJson(JSON.parse(event.target?.result as string), 'file');
			} catch {
				toast.error('Not a valid behavior tree file');
			}
		};
		reader.readAsText(file);
		e.target.value = '';
	};

	const handleExample = async (file: string) => {
		setLoadingExample(file);
		try {
			const response = await fetch(`/examples/${file}.json`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			importJson(await response.json(), 'example');
		} catch (error) {
			console.error('Failed to load example', error);
			toast.error('Could not load the example');
		} finally {
			setLoadingExample(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="text-fg">Import</DialogTitle>
					<DialogDescription>
						Add a tree to this project from an example, pasted JSON, or a file.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="examples">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="examples">Examples</TabsTrigger>
						<TabsTrigger value="paste">Paste JSON</TabsTrigger>
						<TabsTrigger value="file">File</TabsTrigger>
					</TabsList>

					<TabsContent value="examples" className="mt-4 space-y-2">
						{EXAMPLES.map((example) => (
							<button
								key={example.file}
								onClick={() => handleExample(example.file)}
								disabled={loadingExample !== null}
								className="w-full rounded-md border border-border p-3 text-left transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-60"
							>
								<div className="flex items-center gap-2 text-sm font-medium text-fg">
									<Workflow className="h-4 w-4 shrink-0 text-accent-soft" />
									{example.title}
									{loadingExample === example.file && (
										<span className="text-faint">— loading…</span>
									)}
								</div>
								<p className="mt-1 text-[13px] text-muted">{example.description}</p>
							</button>
						))}
					</TabsContent>

					<TabsContent value="paste" className="mt-4">
						<textarea
							value={pasted}
							onChange={(e) => setPasted(e.target.value)}
							placeholder='Paste behavior tree JSON here — a project, a tree, or nodes…'
							className="h-[240px] w-full resize-none font-mono text-sm"
							autoFocus
						/>
						<div className="mt-3 flex justify-end">
							<Button onClick={handlePasteImport} disabled={!pasted.trim()} className="gap-2">
								<ClipboardPaste className="h-4 w-4" />
								Import pasted JSON
							</Button>
						</div>
					</TabsContent>

					<TabsContent value="file" className="mt-4">
						<button
							onClick={() => fileInputRef.current?.click()}
							className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border p-8 text-muted transition-colors hover:border-accent hover:text-accent-soft"
						>
							<FileUp className="h-6 w-6" />
							<span className="text-sm">Choose a .json file…</span>
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".json,application/json"
							className="hidden"
							onChange={handleFileImport}
						/>
					</TabsContent>
				</Tabs>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default ImportModal;
