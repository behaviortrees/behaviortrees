import { AnalyticsEventMap, captureError, track } from './analytics';
import { InvalidFileError } from './behavior/import-error';

type ImportContext = Omit<AnalyticsEventMap['import_failed'], 'reason' | 'detail'>;

// JSON.parse failed. Chrome and Safari quote a snippet of the input in the
// message ('Unexpected token 'a', "abc" is not valid JSON'), which stays out.
export function trackInvalidJson(error: unknown, context: ImportContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const detail = message.replace(/"[^]*"(\.\.\.)?/, '"…"').slice(0, 160);
  track('import_failed', { ...context, reason: 'invalid_json', ...(detail ? { detail } : {}) });
}

// An import threw: a file we can't read is an expected failure, anything else
// is an importer bug, so it also goes to error tracking.
export function trackImportError(error: unknown, context: ImportContext): void {
  if (error instanceof InvalidFileError) {
    track('import_failed', {
      ...context,
      reason: error.reason,
      ...(error.detail ? { detail: error.detail } : {}),
    });
    return;
  }
  track('import_failed', { ...context, reason: 'unexpected' });
  captureError(error, { import_source: context.source, import_format: context.format });
}
