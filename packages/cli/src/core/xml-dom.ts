// The BT.CPP reader parses XML with the browser's DOMParser. Node has none, so
// borrow jsdom's (the same one the editor's BT.CPP tests run against), loaded
// only when XML actually comes in.
let ready: Promise<void> | undefined;

export const ensureDomParser = (): Promise<void> =>
	(ready ??= (async () => {
		if (typeof globalThis.DOMParser !== 'undefined') return;
		const { JSDOM } = await import('jsdom');
		globalThis.DOMParser = new JSDOM('').window.DOMParser;
	})());
