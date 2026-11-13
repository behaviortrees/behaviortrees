// Names the client behind a request's user agent, for the admin dashboard's
// request-log sections. Classified when the dashboard loads rather than on
// ingest, so a better rule here also fixes the history.

export type AgentKind =
  // An AI app or coding agent acting for a person right now
  | 'assistant'
  // AI training and answer-engine crawlers
  | 'ai_crawler'
  | 'search'
  | 'social'
  | 'seo'
  // Everything else that says it's automated: MCP directories, probes, monitors
  | 'bot'
  // HTTP libraries and SDKs: someone's script, or a bot that didn't say
  | 'library'
  | 'browser'
  | 'unknown';

export type Agent = { name: string; kind: AgentKind };

const NAMED: [RegExp, string, AgentKind][] = [
  [/^Claude-User\b/, 'Claude (apps)', 'assistant'],
  [/^claude-code\//, 'Claude Code / Desktop', 'assistant'],
  [/^openai-mcp\b/i, 'ChatGPT (connector)', 'assistant'],
  [/\bChatGPT-User\b/, 'ChatGPT (browsing)', 'assistant'],
  [/\bPerplexity-User\b/, 'Perplexity (browsing)', 'assistant'],
  [/\bMistralAI-User\b/, 'Mistral (browsing)', 'assistant'],
  [/\bDuckAssistBot\b/, 'DuckDuckGo Assist', 'assistant'],
  [/^Cursor\//, 'Cursor', 'assistant'],
  [/Visual Studio Code|^vscode\//i, 'VS Code', 'assistant'],
  [/^coda-agent-runtime\b/, 'Coda agents', 'assistant'],
  [/\bGPTBot\b/, 'GPTBot', 'ai_crawler'],
  [/\bOAI-SearchBot\b/, 'OAI-SearchBot', 'ai_crawler'],
  [/\bClaudeBot\b/, 'ClaudeBot', 'ai_crawler'],
  [/\bClaude-SearchBot\b/, 'Claude-SearchBot', 'ai_crawler'],
  [/\banthropic-ai\b/, 'anthropic-ai', 'ai_crawler'],
  [/\bPerplexityBot\b/, 'PerplexityBot', 'ai_crawler'],
  [/\bCCBot\b/, 'CCBot', 'ai_crawler'],
  [/\bBytespider\b/, 'Bytespider', 'ai_crawler'],
  [/\bAmazonbot\b/, 'Amazonbot', 'ai_crawler'],
  [/\bmeta-externalagent\b/, 'Meta AI', 'ai_crawler'],
  [/\bcohere-ai\b/, 'Cohere', 'ai_crawler'],
  [/\bGooglebot\b/, 'Googlebot', 'search'],
  [/\bGoogleOther\b|\bGoogle-InspectionTool\b/, 'Google (other)', 'search'],
  [/\bbingbot\b/i, 'Bingbot', 'search'],
  [/\bApplebot\b/, 'Applebot', 'search'],
  [/\bDuckDuckBot\b/, 'DuckDuckBot', 'search'],
  [/\bYandex(Bot)?\b/, 'YandexBot', 'search'],
  [/\bBaiduspider\b/, 'Baiduspider', 'search'],
  [/\bYeti\//, 'Naver', 'search'],
  [/\bSeznamBot\b/, 'SeznamBot', 'search'],
  [/\bfacebookexternalhit\b/, 'Facebook', 'social'],
  [/\bTwitterbot\b/, 'X (Twitter)', 'social'],
  [/\bLinkedInBot\b/, 'LinkedIn', 'social'],
  [/\bSlackbot\b/, 'Slack', 'social'],
  [/\bDiscordbot\b/, 'Discord', 'social'],
  [/\bTelegramBot\b/, 'Telegram', 'social'],
  [/\bWhatsApp\b/, 'WhatsApp', 'social'],
  [/\bAhrefsBot\b/, 'AhrefsBot', 'seo'],
  [/\bSemrushBot\b/, 'SemrushBot', 'seo'],
  [/\bMJ12bot\b/, 'MJ12bot', 'seo'],
  [/\bDotBot\b/, 'DotBot', 'seo'],
  [/\bDataForSeoBot\b/, 'DataForSeoBot', 'seo'],
  [/\bHeadlessChrome\//, 'Headless Chrome', 'bot'],
];

const BOT =
  /bot\b|bot\/|crawl|spider|probe|indexer|scanner|monitor|checker|uptime|health|liveness|census|survey|research|radar|\+https?:\/\//i;
const LIBRARY =
  /^(node|undici|axios|got|python-[\w-]+|Python|aiohttp|httpx|ai-sdk|curl|wget|Go-http-client|okhttp|Java|Apache-HttpClient|Deno|Bun|Ruby|PHP|libwww-perl|reqwest|Dart)\b/i;

// The product token: "mcptry.com indexer (+https://…)" -> "mcptry.com"
const product = (ua: string) => ua.replace(/^Mozilla\/[\d.]+ \(compatible; /, '').split(/[\s/;()]/)[0] || ua;

export function classifyAgent(userAgent: string | null | undefined): Agent {
  const ua = (userAgent ?? '').trim();
  if (!ua || ua === '-') return { name: 'No user agent', kind: 'unknown' };
  for (const [pattern, name, kind] of NAMED) {
    if (pattern.test(ua)) return { name, kind };
  }
  if (BOT.test(ua)) return { name: product(ua).slice(0, 40), kind: 'bot' };
  if (LIBRARY.test(ua)) return { name: product(ua).toLowerCase(), kind: 'library' };
  if (/^Mozilla\/5\.0 \(/.test(ua)) return { name: 'Browsers', kind: 'browser' };
  return { name: product(ua).slice(0, 40), kind: 'unknown' };
}
