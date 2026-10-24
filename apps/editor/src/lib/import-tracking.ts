import { AnalyticsEventMap, captureError, track } from './analytics';
import { InvalidFileError } from './behavior/import-error';

type ImportContext = Omit<AnalyticsEventMap['import_failed'], 'reason'>;

// An import threw: a file we can't read is an expected failure, anything else
// is an importer bug, so it also goes to error tracking.
export function trackImportError(error: unknown, context: ImportContext): void {
  if (error instanceof InvalidFileError) {
    track('import_failed', { ...context, reason: error.reason });
    return;
  }
  track('import_failed', { ...context, reason: 'unexpected' });
  captureError(error, { import_source: context.source, import_format: context.format });
}
