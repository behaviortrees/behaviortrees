import React from 'react';
import { formatNumber } from './admin-format';

// Building blocks shared by the admin dashboard's cards

export const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="card">
    <div className="text-2xl font-medium">{value}</div>
    <div className="text-sm text-muted mt-1">{label}</div>
  </div>
);

export const SectionErrorBox: React.FC<{ source: string; error: string }> = ({ source, error }) => (
  <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
    Failed to load {source}: {error}
  </div>
);

// Simple CSS bar list — no chart dependency
export const BarList: React.FC<{ points: { label: string; value: number }[] }> = ({ points }) => {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex items-end gap-[2px] h-24">
      {points.map((point) => (
        <div
          key={point.label}
          className="flex-1 rounded-t-sm bg-accent/60 hover:bg-accent transition-colors min-h-[2px]"
          style={{ height: `${Math.max((point.value / max) * 100, 2)}%` }}
          title={`${point.label}: ${formatNumber(point.value)}`}
        />
      ))}
    </div>
  );
};

export const RankedTable: React.FC<{
  title: string;
  rows: { name: string; value: number }[];
}> = ({ title, rows }) => (
  <div className="flex-1 min-w-0">
    <h3 className="text-sm font-medium text-muted mb-2">{title}</h3>
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-t border-divider">
            <td className="py-1.5 pr-4 truncate max-w-0 w-full">{row.name}</td>
            <td className="py-1.5 text-right text-muted tabular-nums">
              {formatNumber(row.value)}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td className="py-1.5 text-faint">No data</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);
