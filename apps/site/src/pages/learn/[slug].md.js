import { guideMarkdown, guides } from '../../lib/guides.js';

export const getStaticPaths = () => guides.map((guide) => ({ params: { slug: guide.slug }, props: { guide } }));

export const GET = ({ props }) =>
    new Response(guideMarkdown(props.guide), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
