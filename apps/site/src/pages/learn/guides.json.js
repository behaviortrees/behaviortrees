import { guides } from '../../lib/guides.js';

// Read by the behaviortrees CLI and MCP server (packages/cli) to list guides
export const GET = () =>
    new Response(
        JSON.stringify(
            guides.map((guide) => ({
                slug: guide.slug,
                title: guide.frontmatter.title,
                description: guide.frontmatter.description,
                url: guide.url,
                markdownUrl: guide.markdownUrl,
            })),
            null,
            2,
        ),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
