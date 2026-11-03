import { FormEvent, useState } from 'react';
import { DialogRequest, settle, useDialogStore } from '../lib/dialogs';
import { Button } from './ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from './ui/dialog';

const PromptForm = ({ request }: { request: Extract<DialogRequest, { kind: 'prompt' }> }) => {
	const [value, setValue] = useState(request.defaultValue ?? '');
	const trimmed = value.trim();

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (trimmed) settle(trimmed);
	};

	return (
		<form onSubmit={submit} className="grid gap-4">
			<div>
				{request.label && (
					<label htmlFor="dialog-prompt-input" className="block text-sm font-medium mb-1">
						{request.label}
					</label>
				)}
				<input
					id="dialog-prompt-input"
					type="text"
					value={value}
					onChange={e => setValue(e.target.value)}
					onFocus={e => e.target.select()}
					placeholder={request.placeholder}
					className="text-sm w-full"
					autoComplete="off"
					data-1p-ignore
					data-lpignore="true"
					data-bwignore
					autoFocus
				/>
			</div>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={() => settle(null)}>
					Cancel
				</Button>
				<Button type="submit" disabled={!trimmed}>
					{request.submitLabel ?? 'OK'}
				</Button>
			</DialogFooter>
		</form>
	);
};

export const DialogHost = () => {
	const { request, open } = useDialogStore();

	return (
		<Dialog open={open} onOpenChange={next => { if (!next) settle(null); }}>
			{request && (
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>{request.title}</DialogTitle>
						{request.description ? (
							<DialogDescription>{request.description}</DialogDescription>
						) : (
							<DialogDescription className="sr-only">{request.title}</DialogDescription>
						)}
					</DialogHeader>
					{request.kind === 'prompt' ? (
						<PromptForm key={request.id} request={request} />
					) : (
						<DialogFooter>
							<Button variant="outline" onClick={() => settle(false)}>
								Cancel
							</Button>
							<Button
								variant={request.destructive ? 'destructive' : 'default'}
								onClick={() => settle(true)}
							>
								{request.confirmLabel ?? 'OK'}
							</Button>
						</DialogFooter>
					)}
				</DialogContent>
			)}
		</Dialog>
	);
};
