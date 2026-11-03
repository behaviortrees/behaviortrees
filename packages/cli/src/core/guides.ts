import { SITE } from './site';

export type Guide = { slug: string; title: string; description: string; url: string; markdownUrl: string };

const get = async (url: string): Promise<Response> => {
	const response = await fetch(url, { headers: { 'User-Agent': 'behaviortrees-cli' } });
	if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
	return response;
};

// The guides at behaviortrees.com/learn, fetched live so they're always current
export const listGuides = async (): Promise<Guide[]> => (await get(`${SITE}/learn/guides.json`)).json() as Promise<Guide[]>;

// The site's book links carry an Amazon affiliate tag. Guides served to AI
// assistants keep the links but not the tag: connector directories don't allow
// sponsored or promotional content in tool results.
export const stripAffiliateTags = (markdown: string): string =>
	markdown.replace(/(https:\/\/www\.amazon\.com\/[^\s)?"]*)\?tag=[\w-]+/g, '$1');

export const readGuide = async (slug: string): Promise<string> => {
	if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Not a guide slug: ${slug}`);
	const response = await fetch(`${SITE}/learn/${slug}.md`, { headers: { 'User-Agent': 'behaviortrees-cli' } });
	if (response.status === 404) {
		const slugs = (await listGuides()).map((guide) => guide.slug);
		throw new Error(`No guide "${slug}". Guides: ${slugs.join(', ')}`);
	}
	if (!response.ok) throw new Error(`Guide request returned HTTP ${response.status}`);
	return stripAffiliateTags(await response.text());
};
