import React, { useMemo, useRef, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Project } from '../../types';
import { customNodesToB3, projectToB3, treeToB3 } from '../../lib/behavior/b3';
import { BtcppIssue, nodesToBtcpp, projectToBtcpp, treeToBtcpp } from '../../lib/behavior/btcpp';
import { track } from '../../lib/analytics';
import { recordActivation } from '../../lib/product-metrics';
import { shareLinkFor } from '../../lib/share-link';
import { toast } from 'sonner';
import { CheckIcon, DownloadIcon, ClipboardIcon, ChevronDownIcon, LinkIcon } from 'lucide-react';

export type ExportType = 'project' | 'tree' | 'nodes';

type ExportFormat = 'json' | 'compact' | 'btcpp_v4' | 'btcpp_v3';

const isXml = (format: ExportFormat) => format === 'btcpp_v4' || format === 'btcpp_v3';

// Chat apps and some browsers truncate URLs past a few tens of thousands of characters
const LONG_LINK = 30_000;

const ISSUE_COLOR: Record<BtcppIssue['level'], string> = {
	error: 'text-danger',
	warning: 'text-warning',
	info: 'text-muted',
};

const NO_EXPORT: { text: string; issues: BtcppIssue[] } = { text: '', issues: [] };

function buildExport(
	project: Project | null,
	selectedTreeId: string | undefined,
	type: ExportType,
	format: ExportFormat,
): { text: string; issues: BtcppIssue[] } {
	if (!project) return { text: 'No project loaded', issues: [] };
	const tree = selectedTreeId ? project.trees[selectedTreeId] : undefined;
	if (type === 'tree' && !tree) return { text: 'No tree selected', issues: [] };

	try {
		if (isXml(format)) {
			const options = { version: format === 'btcpp_v3' ? 3 : 4 } as const;
			const result =
				type === 'project'
					? projectToBtcpp(project, options)
					: type === 'tree'
						? treeToBtcpp(project, selectedTreeId!, options)
						: nodesToBtcpp(project, options);
			return { text: result.xml, issues: result.issues };
		}

		const data =
			type === 'project'
				? projectToB3(project)
				: type === 'tree'
					? // Standalone tree files carry the project's custom nodes
						treeToB3(tree!, project, true)
					: customNodesToB3(project);
		return {
			text: format === 'json' ? JSON.stringify(data, null, 2) : JSON.stringify(data),
			issues: [],
		};
	} catch (error) {
		console.error('Error generating export data:', error);
		return { text: `Error generating export data: ${error}`, issues: [] };
	}
}

interface ExportModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	exportType?: ExportType;
}

const ExportModal: React.FC<ExportModalProps> = ({
	open,
	onOpenChange,
	exportType = 'project',
}) => {
	const [type, setType] = useState<ExportType>(exportType);
	const [wasOpen, setWasOpen] = useState(open);

	// The dialog stays mounted, so take the requested type each time it opens
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) setType(exportType);
	}
	const [format, setFormat] = useState<ExportFormat>('json');
	const [copied, setCopied] = useState(false);
	const textAreaRef = useRef<HTMLTextAreaElement>(null);

	const project = useProjectStore((state) => state.project);
	const selectedTreeId = useProjectStore((state) => state.project?.selectedTreeId);

	// Only while open: the dialog stays mounted through every edit
	const { text: exportData, issues } = useMemo(
		() => (open ? buildExport(project, selectedTreeId, type, format) : NO_EXPORT),
		[open, project, selectedTreeId, type, format],
	);

	// A link that opens this tree or project in the editor (always behavior3 JSON)
	const handleCopyLink = async () => {
		if (!project) return;
		try {
			const tree = selectedTreeId ? project.trees[selectedTreeId] : undefined;
			if (type === 'tree' && !tree) return;
			const data = type === 'tree' ? treeToB3(tree!, project, true) : projectToB3(project);
			const link = await shareLinkFor(data);
			await navigator.clipboard.writeText(link);
			track('export', { type, format, method: 'link' });
			recordActivation(project, 'export');
			if (link.length > LONG_LINK) {
				toast.warning('Link copied, but it is long: some apps may cut it off. Download the file to be safe.');
			} else {
				toast.success('Link copied: it opens this ' + (type === 'tree' ? 'tree' : 'project') + ' in the editor');
			}
		} catch (error) {
			console.error('Error copying link:', error);
			toast.error('Failed to copy link');
		}
	};

	// Handle copy to clipboard
	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(exportData);
			setCopied(true);
			track('export', { type, format, method: 'copy' });
			if (project) recordActivation(project, 'export');
			toast.success('Copied to clipboard');

			// Reset copied status after a delay
			setTimeout(() => {
				setCopied(false);
			}, 2000);
		} catch (error) {
			console.error('Error copying to clipboard:', error);
			toast.error('Failed to copy to clipboard');

			// Fallback to the old method if the Clipboard API fails
			if (textAreaRef.current) {
				textAreaRef.current.select();
				document.execCommand('copy');
				setCopied(true);
				toast.success('Copied to clipboard (fallback method)');

				setTimeout(() => {
					setCopied(false);
				}, 2000);
			}
		}
	};

	// Handle download
	const handleDownload = () => {
		try {
			const extension = isXml(format) ? 'xml' : 'json';
			const blob = new Blob([exportData], { type: isXml(format) ? 'application/xml' : 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');

			let fileName = '';

			if (type === 'project' && project) {
				fileName = `${project.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.${extension}`;
			} else if (type === 'tree' && selectedTreeId && project?.trees[selectedTreeId]) {
				fileName = `tree_${project.trees[selectedTreeId].title
					.replace(/\s+/g, '_')
					.toLowerCase()}_${Date.now()}.${extension}`;
			} else if (type === 'nodes') {
				fileName = `custom_nodes_${Date.now()}.${extension}`;
			} else {
				fileName = `${type}_export_${Date.now()}.${extension}`;
			}

			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			track('export', { type, format, method: 'download' });
			if (project) recordActivation(project, 'export');
			toast.success('Export file downloaded');
		} catch (error) {
			console.error('Error downloading export:', error);
			toast.error('Error downloading export');
		}
	};

	// Change export type
	const changeType = (newType: ExportType) => {
		setType(newType);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[700px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-fg">
						Export
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" className="ml-2">
									{type.charAt(0).toUpperCase() + type.slice(1)}
									<ChevronDownIcon className="ml-2 h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuItem onClick={() => changeType('project')}>Project</DropdownMenuItem>
								<DropdownMenuItem onClick={() => changeType('tree')}>Tree</DropdownMenuItem>
								<DropdownMenuItem onClick={() => changeType('nodes')}>Nodes</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</DialogTitle>
					<DialogDescription>
						Export your {type} as behavior3 JSON or as BehaviorTree.CPP XML for ROS 2 and Groot2.
					</DialogDescription>
				</DialogHeader>

				<Tabs value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
					<TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
						<TabsTrigger value="json">JSON</TabsTrigger>
						<TabsTrigger value="compact">Compact JSON</TabsTrigger>
						<TabsTrigger value="btcpp_v4">BT.CPP v4</TabsTrigger>
						<TabsTrigger value="btcpp_v3" title="BehaviorTree.CPP 3.8, used by ROS 2 Humble">
							BT.CPP v3
						</TabsTrigger>
					</TabsList>

					<div className="mt-4 relative">
						<textarea
							ref={textAreaRef}
							readOnly
							className="h-[300px] font-mono text-sm resize-none"
							value={exportData}
						/>
					</div>

					{issues.length > 0 && (
						<div className="mt-3 max-h-[140px] overflow-y-auto rounded-md border border-border p-3 text-[13px]">
							{issues.some((i) => i.level === 'error') && (
								<p className="mb-2 font-medium text-danger">
									BehaviorTree.CPP will reject this file until the errors are fixed.
								</p>
							)}
							<ul className="space-y-1">
								{issues.map((issue) => (
									<li key={issue.message} className={ISSUE_COLOR[issue.level]}>
										<span className="mr-1.5 font-medium capitalize">{issue.level}:</span>
										{issue.message}
									</li>
								))}
							</ul>
						</div>
					)}
				</Tabs>

				<DialogFooter className="sm:justify-between">
					<div className="flex gap-2">
						<Button variant="secondary" onClick={handleCopy} className="gap-2">
							{copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
							{copied ? 'Copied' : 'Copy'}
						</Button>
						{type !== 'nodes' && (
							<Button variant="secondary" onClick={handleCopyLink} className="gap-2">
								<LinkIcon className="h-4 w-4" />
								Copy link
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						<Button onClick={handleDownload} className="gap-2">
							<DownloadIcon className="h-4 w-4" />
							Download
						</Button>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default ExportModal;
