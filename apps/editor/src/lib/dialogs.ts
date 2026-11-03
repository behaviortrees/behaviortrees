import { create } from 'zustand';

interface DialogText {
	title: string;
	description?: string;
}

export interface ConfirmOptions extends DialogText {
	confirmLabel?: string;
	destructive?: boolean;
}

export interface PromptOptions extends DialogText {
	label?: string;
	defaultValue?: string;
	placeholder?: string;
	submitLabel?: string;
}

export type DialogRequest =
	| (ConfirmOptions & { kind: 'confirm'; id: number; resolve: (ok: boolean) => void })
	| (PromptOptions & { kind: 'prompt'; id: number; resolve: (value: string | null) => void });

interface DialogState {
	request: DialogRequest | null;
	open: boolean;
}

// The request outlives `open` so the dialog keeps its content while it
// animates closed
export const useDialogStore = create<DialogState>(() => ({ request: null, open: false }));

let nextId = 0;

export const settle = (result: boolean | string | null) => {
	const { request, open } = useDialogStore.getState();
	if (!request || !open) return;
	if (request.kind === 'confirm') request.resolve(result === true);
	else request.resolve(typeof result === 'string' ? result : null);
	useDialogStore.setState({ open: false });
};

const show = (request: DialogRequest) => {
	settle(null);
	useDialogStore.setState({ request, open: true });
};

// In-app replacements for window.confirm and window.prompt. They need
// <DialogHost /> mounted, which the app shell does.
export const confirmDialog = (options: ConfirmOptions) =>
	new Promise<boolean>(resolve => show({ ...options, kind: 'confirm', id: nextId++, resolve }));

export const promptDialog = (options: PromptOptions) =>
	new Promise<string | null>(resolve => show({ ...options, kind: 'prompt', id: nextId++, resolve }));
