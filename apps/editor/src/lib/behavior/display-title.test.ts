import { describe, expect, it } from 'vitest';
import { displayTitle } from './display-title';

describe('displayTitle', () => {
  it('fills placeholders from properties', () => {
    expect(displayTitle('Wait <milliseconds>ms', { milliseconds: 2000 })).toBe('Wait 2000ms');
    expect(displayTitle('Repeat <maxLoop>x', { maxLoop: -1 })).toBe('Repeat -1x');
    expect(displayTitle('<a> and <b>', { a: 'x', b: false })).toBe('x and false');
  });

  it('keeps placeholders it has no value for', () => {
    expect(displayTitle('Max <maxTime>ms', {})).toBe('Max <maxTime>ms');
    expect(displayTitle('Max <maxTime>ms', { maxTime: '' })).toBe('Max <maxTime>ms');
    expect(displayTitle('Max <maxTime>ms', undefined)).toBe('Max <maxTime>ms');
    expect(displayTitle('<toString>', {})).toBe('<toString>');
  });

  it('leaves titles without placeholders alone', () => {
    expect(displayTitle('Chase Player', { speed: 4 })).toBe('Chase Player');
    expect(displayTitle('a < b > c', { b: 1 })).toBe('a < b > c');
  });
});
