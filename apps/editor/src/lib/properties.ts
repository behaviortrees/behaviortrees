/**
 * Property value coercion, matching the classic editor.
 *
 * The old key-table did numeric coercion and nothing else
 * (src/app/directives/keytable.directive.js:85-87):
 *
 *     if (!isNaN(value) && value !== '') value = parseFloat(value);
 *
 * so `true` was stored as the string "true". We keep that numeric rule exactly
 * and add real booleans, which is the one gap that behaviour had.
 */
export function inferPropertyValue(raw: string): string | number | boolean {
	const text = raw.trim();
	if (text === '') return '';

	const lower = text.toLowerCase();
	if (lower === 'true') return true;
	if (lower === 'false') return false;

	// The legacy rule let "   " and "Infinity" through, which serialise to null
	// on export. Require a finite result before accepting the coercion.
	if (!isNaN(text as unknown as number)) {
		const num = parseFloat(text);
		if (Number.isFinite(num)) return num;
	}

	return raw;
}

/** Renders a stored value for a text input — bare, never JSON-quoted. */
export function formatPropertyValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

/**
 * Whether edits to a property keep the typed text instead of coercing it.
 *
 * BehaviorTree.CPP XML is text: `hz="1.0"` must not come back as `1`. The
 * classic editor always stored numeric input as numbers, so a value that is
 * still text yet looks numeric (or boolean) came from XML; so did any node
 * with BT.CPP port metadata. Everything else keeps the classic coercion.
 */
export function keepsText(current: unknown, nodeHasPorts: boolean): boolean {
	if (nodeHasPorts) return true;
	return typeof current === 'string' && current !== '' && inferPropertyValue(current) !== current;
}
