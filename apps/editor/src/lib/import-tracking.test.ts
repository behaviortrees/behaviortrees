import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureError, track } from './analytics';
import { InvalidFileError } from './behavior/import-error';
import { trackImportError } from './import-tracking';

vi.mock('./analytics', () => ({ captureError: vi.fn(), track: vi.fn() }));

describe('trackImportError', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks an unreadable file by its reason, without reporting an exception', () => {
    trackImportError(new InvalidFileError('Not valid XML', 'invalid_xml'), { source: 'paste', format: 'btcpp' });
    expect(track).toHaveBeenCalledWith('import_failed', { source: 'paste', format: 'btcpp', reason: 'invalid_xml' });
    expect(captureError).not.toHaveBeenCalled();
  });

  it('reports any other error as an importer bug', () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'id')");
    trackImportError(bug, { source: 'file', format: 'b3' });
    expect(track).toHaveBeenCalledWith('import_failed', { source: 'file', format: 'b3', reason: 'unexpected' });
    expect(captureError).toHaveBeenCalledWith(bug, { import_source: 'file', import_format: 'b3' });
  });
});
