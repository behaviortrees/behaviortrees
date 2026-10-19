import { describe, expect, it } from 'vitest';
import { inferPropertyValue, keepsText } from './properties';

describe('keepsText', () => {
	it('keeps BT.CPP text that the classic rules would have coerced', () => {
		expect(keepsText('1.0', false)).toBe(true);
		expect(keepsText('0.30', false)).toBe(true);
		expect(keepsText('true', false)).toBe(true);
	});

	it('keeps text for any node with BT.CPP ports', () => {
		expect(keepsText('', true)).toBe(true);
		expect(keepsText(5, true)).toBe(true);
	});

	it('leaves behavior3 values on the classic coercion', () => {
		expect(keepsText(2000, false)).toBe(false);
		expect(keepsText('{goal}', false)).toBe(false);
		expect(keepsText('', false)).toBe(false);
		expect(keepsText(true, false)).toBe(false);
		expect(inferPropertyValue('4.5')).toBe(4.5);
	});
});
