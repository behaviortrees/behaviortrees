import type { SectionError } from '../../lib/api-client';

export function isSectionError(section: object): section is SectionError {
  return 'error' in section;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
