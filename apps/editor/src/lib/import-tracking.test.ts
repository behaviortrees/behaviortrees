import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureError, track } from './analytics';
import { InvalidFileError } from './behavior/import-error';
import { trackImportError, trackInvalidJson } from './import-tracking';

vi.mock('./analytics', () => ({ captureError: vi.fn(), track: vi.fn() }));

describe('trackImportError', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks an unreadable file by its reason, without reporting an exception', () => {
    trackImportError(new InvalidFileError('Not valid XML', 'invalid_xml'), { source: 'paste', format: 'btcpp' });
    expect(track).toHaveBeenCalledWith('import_failed', { source: 'paste', format: 'btcpp', reason: 'invalid_xml' });
    expect(captureError).not.toHaveBeenCalled();
  });

  it('includes the parser detail when there is one', () => {
    trackImportError(new InvalidFileError('Not valid XML', 'invalid_xml', '1:27: unclosed tag: Sequence'), {
      source: 'file',
      format: 'btcpp',
    });
    expect(track).toHaveBeenCalledWith('import_failed', {
      source: 'file',
      format: 'btcpp',
      reason: 'invalid_xml',
      detail: '1:27: unclosed tag: Sequence',
    });
  });

  it('reports any other error as an importer bug', () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'id')");
    trackImportError(bug, { source: 'file', format: 'b3' });
    expect(track).toHaveBeenCalledWith('import_failed', { source: 'file', format: 'b3', reason: 'unexpected' });
    expect(captureError).toHaveBeenCalledWith(bug, { import_source: 'file', import_format: 'b3' });
  });
});

describe('trackInvalidJson', () => {
  beforeEach(() => vi.clearAllMocks());

  const parseError = (text: string) => {
    try {
      JSON.parse(text);
    } catch (error) {
      return error;
    }
    throw new Error('expected JSON.parse to fail');
  };
  const detailFor = (error: unknown) => {
    trackInvalidJson(error, { source: 'paste', format: 'b3' });
    return vi.mocked(track).mock.calls[0][1] as { detail?: string };
  };

  it('keeps where the JSON breaks', () => {
    expect(detailFor(parseError('{\n  "a": 1\n  "b": 2\n}'))).toEqual({
      source: 'paste',
      format: 'b3',
      reason: 'invalid_json',
      detail: "Expected ',' or '}' after property value in JSON at position 13 (line 3 column 3)",
    });
  });

  it.each([
    ['V8', parseError('root:\n  - Sequence "secret name"'), "Unexpected token 'r', \"…\" is not valid JSON"],
    ['Safari', new SyntaxError('JSON Parse error: Unexpected identifier "secret"'), 'JSON Parse error: Unexpected identifier "…"'],
    [
      'Firefox',
      new SyntaxError('JSON.parse: unexpected character at line 1 column 1 of the JSON data'),
      'JSON.parse: unexpected character at line 1 column 1 of the JSON data',
    ],
  ])('leaves out the input %s quotes back', (_engine, error, detail) => {
    expect(detailFor(error).detail).toBe(detail);
  });
});
