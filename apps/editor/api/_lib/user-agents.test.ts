import { describe, expect, it } from 'vitest';
import { classifyAgent } from './user-agents.js';

// User agents taken from the production request logs
describe('classifyAgent', () => {
  it.each([
    ['Claude-User', 'Claude (apps)', 'assistant'],
    ['claude-code/2.1.321 (claude-desktop, agent-sdk/0.3.321)', 'Claude Code / Desktop', 'assistant'],
    ['claude-code/2.1.323 (cli)', 'Claude Code / Desktop', 'assistant'],
    ['openai-mcp/1.0.0 (+https://openai.com/bot)', 'ChatGPT (connector)', 'assistant'],
    ['coda-agent-runtime', 'Coda agents', 'assistant'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)', 'ChatGPT (browsing)', 'assistant'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'GPTBot', 'ai_crawler'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'ClaudeBot', 'ai_crawler'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36', 'Bingbot', 'search'],
    ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'YandexBot', 'search'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Googlebot', 'search'],
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Facebook', 'social'],
    ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'AhrefsBot', 'seo'],
    ['mcptry.com indexer (+https://mcptry.com/about)', 'mcptry.com', 'bot'],
    ['mcpbeat/0.1 (+https://mcpbeat.com/bot/; liveness check)', 'mcpbeat', 'bot'],
    ['ado-p5-health/1', 'ado-p5-health', 'bot'],
    ['mcp-census/0.1', 'mcp-census', 'bot'],
    ['agent-collector/0.1 (+capability survey; no payment is made)', 'agent-collector', 'bot'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36', 'Headless Chrome', 'bot'],
    ['node', 'node', 'library'],
    ['python-httpx/0.28.1', 'python-httpx', 'library'],
    ['Python/3.13 aiohttp/3.14.5', 'python', 'library'],
    ['Go-http-client/2.0', 'go-http-client', 'library'],
    ['ai-sdk/0.0.0-test bun/1.4.2', 'ai-sdk', 'library'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', 'Browsers', 'browser'],
    ['-', 'No user agent', 'unknown'],
    [null, 'No user agent', 'unknown'],
    ['Talaria', 'Talaria', 'unknown'],
  ])('%s', (ua, name, kind) => {
    expect(classifyAgent(ua)).toEqual({ name, kind });
  });
});
