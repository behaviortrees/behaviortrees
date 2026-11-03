declare const __VERSION__: string | undefined;

// Set from package.json by build.mjs
export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0-dev';
