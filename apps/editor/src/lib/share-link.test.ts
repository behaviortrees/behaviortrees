import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeSharedTree, encodeSharedTree } from './share-link';

const TREE = {
	title: 'Guard',
	root: 'a',
	nodes: {
		a: { id: 'a', name: 'Priority', children: ['b', 'c'] },
		b: { id: 'b', name: 'Attack' },
		c: { id: 'c', name: 'Patrol' },
	},
};

describe('shared tree links', () => {
	it('round-trips through the compressed encoding', async () => {
		const encoded = await encodeSharedTree(TREE);
		expect(encoded).toMatch(/^[\w-]+$/);
		expect(await decodeSharedTree(encoded)).toEqual({ data: TREE, encoding: 'deflate' });
	});

	it('reads links made with zlib outside the browser (Python, Node)', async () => {
		const encoded = deflateSync(JSON.stringify(TREE)).toString('base64url');
		expect((await decodeSharedTree(encoded)).data).toEqual(TREE);
	});

	it('reads URL-encoded plain JSON', async () => {
		expect(await decodeSharedTree(encodeURIComponent(JSON.stringify(TREE)))).toEqual({ data: TREE, encoding: 'json' });
	});

	it('reads plain JSON that was never percent-encoded', async () => {
		expect((await decodeSharedTree('{"title":"100% done","root":null,"nodes":{}}')).data).toMatchObject({
			title: '100% done',
		});
	});

	it('rejects payloads that inflate past the size cap', async () => {
		const bomb = deflateSync(`"${'a'.repeat(6_000_000)}"`).toString('base64url');
		await expect(decodeSharedTree(bomb)).rejects.toThrow('too large');
	});

	it('rejects garbage', async () => {
		await expect(decodeSharedTree('not-a-tree')).rejects.toThrow();
	});
});
