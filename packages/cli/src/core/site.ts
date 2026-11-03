// Overridable for testing against a local or preview deploy
export const SITE = (process.env.BEHAVIORTREES_SITE ?? 'https://www.behaviortrees.com').replace(/\/$/, '');
