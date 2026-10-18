import React, { useState, useRef, useEffect } from 'react';
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
import { customNodesToB3, projectToB3, treeToB3 } from '../../lib/behavior/b3';
import { BtcppIssue, nodesToBtcpp, projectToBtcpp, treeToBtcpp } from '../../lib/behavior/btcpp';
import { track } from '../../lib/analytics';
import { recordActivation } from '../../lib/product-metrics';
import { toast } from 'sonner';
import { CheckIcon, DownloadIcon, ClipboardIcon, ChevronDownIcon } from 'lucide-react';

export type ExportType = 'project' | 'tree' | 'nodes';

type ExportFormat = 'json' | 'compact' | 'btcpp_v4' | 'btcpp_v3';

const isXml = (format: ExportFormat) => format === 'btcpp_v4' || format === 'btcpp_v3';

const ISSUE_COLOR: Record<BtcppIssue['level'], string> = {
	error: 'text-danger',
	warning: 'text-warning',
	info: 'text-muted',
};

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

	// The dialog stays mounted, so take the requested type each time it opens
	useEffect(() => {
		if (open) setType(exportType);
	}, [open, exportType]);
	const [format, setFormat] = useState<ExportFormat>('json');
	const [issues, setIssues] = useState<BtcppIssue[]>([]);
	const [copied, setCopied] = useState(false);
	const textAreaRef = useRef<HTMLTextAreaElement>(null);

	const project = useProjectStore((state) => state.project);
	const selectedTreeId = useProjectStore((state) => state.project?.selectedTreeId);

	const [exportData, setExportData] = useState<string>('');

	// Generate export data based on type and format
	useEffect(() => {
		if (!project) {
			setExportData('No project loaded');
			return;
		}

		let data: unknown;
		setIssues([]);

		try {
			if (isXml(format)) {
				const options = { version: format === 'btcpp_v3' ? 3 : 4 } as const;
				if (type === 'tree' && (!selectedTreeId || !project.trees[selectedTreeId])) {
					setExportData('No tree selected');
					return;
				}
				const result =
					type === 'project'
						? projectToBtcpp(project, options)
						: type === 'tree'
							? treeToBtcpp(project, selectedTreeId!, options)
							: nodesToBtcpp(project, options);
				setExportData(result.xml);
				setIssues(result.issues);
				return;
			}

			if (type === 'project') {
				data = projectToB3(project);
			} else if (type === 'tree') {
				if (!selectedTreeId || !project.trees[selectedTreeId]) {
					setExportData('No tree selected');
					return;
				}
				// Standalone tree files carry the project's custom nodes
				data = treeToB3(project.trees[selectedTreeId], project, true);
			} else if (type === 'nodes') {
				data = customNodesToB3(project);
			}

			setExportData(format === 'json' ? JSON.stringify(data, null, 2) : JSON.stringify(data));
		} catch (error) {
			console.error('Error generating export data:', error);
			setExportData(`Error generating export data: ${error}`);
		}
	}, [project, selectedTreeId, type, format]);

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
