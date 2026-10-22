import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://www.behaviortrees.com';

// Draft articles still build (previewable at their URL, noindex'd by the
// layout) but must not be advertised in the sitemap. The sitemap filter only
// sees URLs, so read the frontmatter here to learn which slugs are drafts.
const learnDir = join(dirname(fileURLToPath(import.meta.url)), 'src/pages/learn');
const draftUrls = new Set(
    readdirSync(learnDir)
        .filter((file) => file.endsWith('.md'))
        .filter((file) => {
            const frontmatter = readFileSync(join(learnDir, file), 'utf8').split('---')[1] ?? '';
            return /^draft:\s*true\s*$/m.test(frontmatter);
        })
        .map((file) => `${SITE}/learn/${file.replace(/\.md$/, '')}/`)
);

// Amazon links in article prose get the same rel the layout's reading list
// uses, so search engines see them as affiliate links.
function rehypeAffiliateLinks() {
    const visit = (node) => {
        if (node.tagName === 'a' && String(node.properties?.href ?? '').startsWith('https://www.amazon.com/')) {
            node.properties.rel = ['sponsored', 'noopener'];
            node.properties.target = '_blank';
        }
        node.children?.forEach(visit);
    };
    return (tree) => visit(tree);
}

export default defineConfig({
    site: SITE,
    trailingSlash: 'always',
    markdown: {
        rehypePlugins: [rehypeAffiliateLinks],
    },
    integrations: [
        sitemap({
            filter: (page) => !draftUrls.has(page),
            // The editor app lives at / outside this Astro build
            customPages: [`${SITE}/`],
        }),
    ],
    build: {
        format: 'directory',
    },
});
