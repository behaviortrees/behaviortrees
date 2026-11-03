// Trees opened from a link: /editor#tree=<payload>. The payload is either
// URL-encoded behavior3 JSON (easy to write by hand or by an LLM) or
// base64url of zlib-deflated JSON (what "Copy link" makes; Python's
// zlib.compress and Node's zlib.deflateSync produce the same format). It lives
// in the fragment, so it never reaches the server.

export type ShareEncoding = 'json' | 'deflate';

const HASH_PREFIX = '#tree=';
// Decompressed size cap, so a tiny link can't inflate into gigabytes
const MAX_BYTES = 5_000_000;

let pending: string | null = null;

// Runs before analytics starts, so the tree never lands in a recorded URL
export function takeSharedTreeFromUrl(): boolean {
	if (!window.location.hash.startsWith(HASH_PREFIX)) return false;
	pending = window.location.hash.slice(HASH_PREFIX.length);
	window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
	return true;
}

export function consumePendingSharedTree(): string | null {
	const payload = pending;
	pending = null;
	return payload;
}

const toBase64Url = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const readCapped = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > MAX_BYTES) {
			await reader.cancel();
			throw new Error('Shared tree is too large');
		}
		chunks.push(value);
	}
	const out = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
};

const transform = (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
	readCapped(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));

export async function encodeSharedTree(data: unknown): Promise<string> {
	const json = new TextEncoder().encode(JSON.stringify(data));
	return toBase64Url(await transform(json, new CompressionStream('deflate')));
}

export async function decodeSharedTree(payload: string): Promise<{ data: unknown; encoding: ShareEncoding }> {
	let text = payload.trim();
	try {
		text = decodeURIComponent(text);
	} catch {
		// Not percent-encoded; use as-is
	}
	if (text.startsWith('{') || text.startsWith('[')) {
		return { data: JSON.parse(text), encoding: 'json' };
	}
	const bytes = await transform(fromBase64Url(text), new DecompressionStream('deflate'));
	return { data: JSON.parse(new TextDecoder().decode(bytes)), encoding: 'deflate' };
}

export async function shareLinkFor(data: unknown): Promise<string> {
	return `${window.location.origin}/editor${HASH_PREFIX}${await encodeSharedTree(data)}`;
}
