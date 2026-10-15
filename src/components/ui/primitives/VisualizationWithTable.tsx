'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface VisualizationWithTableProps<T> {
  /** Title for the visualization region. */
  title: string;
  /** Description for the visualization. */
  description?: string;
  /** The visual representation (chart, meter, progress bars, etc.). */
  visualization: React.ReactNode;
  /** Data array for the accessible data table. */
  data: T[];
  /** Column definitions for the data table. */
  columns: DataTableColumn<T>[];
  /** Unique key extractor for data items. */
  getKey: (item: T, index: number) => string;
  /** Whether the data is provisional. */
  provisional?: boolean;
  /** Whether the data is stale. */
  stale?: boolean;
  /** Source of the data. */
  source?: string;
  /** Timestamp of data. */
  timestamp?: string;
  /** Show the data table (default: true). */
  showTable?: boolean;
  /** Table caption for accessibility. */
  tableCaption?: string;
  /** Empty state message. */
  emptyMessage?: string;
  /** Loading state. */
  isLoading?: boolean;
  /** Error message. */
  error?: string;
  /** Visualization role (default: "img"). */
  visualizationRole?: 'img' | 'region' | 'figure';
  /** Visualization accessible label. */
  visualizationLabel?: string;
  /** Additional CSS classes. */
  className?: string;
  /** Visualization wrapper classes. */
  visualizationClassName?: string;
  /** Table wrapper classes. */
  tableClassName?: string;
}

export function VisualizationWithTable<T>({
  title,
  description,
  visualization,
  data,
  columns,
  getKey,
  provisional = false,
  stale = false,
  source,
  timestamp,
  showTable = true,
  tableCaption,
  emptyMessage = 'No data available',
  isLoading = false,
  error,
  visualizationRole = 'img',
  visualizationLabel,
  className,
  visualizationClassName,
  tableClassName,
}: VisualizationWithTableProps<T>) {
  const regionId = React.useId();
  const vizId = React.useId();
  const tableId = React.useId();
  const descId = React.useId();

  const summaryParts = [title];
  if (provisional) summaryParts.push('Provisional data');
  if (stale) summaryParts.push('Data may be stale');
  if (data.length > 0) summaryParts.push(`${data.length} data point${data.length !== 1 ? 's' : ''}`);
  if (source) summaryParts.push(`Source: ${source}`);
  if (timestamp) summaryParts.push(`Updated: ${new Date(timestamp).toLocaleString()}`);

  if (isLoading) {
    return (
      <div
        id={regionId}
        role="status"
        aria-label={title}
        aria-busy="true"
        className={cn('space-y-3', className)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
        </div>
        <div
          role={visualizationRole}
          aria-label={visualizationLabel ?? title}
          aria-busy="true"
          className={cn('animate-pulse', visualizationClassName)}
        >
          <div className="h-32 bg-muted/50 rounded-lg" />
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div
        id={regionId}
        role="alert"
        aria-live="assertive"
        className={cn('rounded-lg border border-destructive bg-destructive/10 p-4', className)}
      >
        <h3 className="font-medium text-destructive">{title}</h3>
        <p className="mt-1 text-sm text-destructive/90">{error}</p>
        {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
      </div>
    );
  }

  return (
    <div
      id={regionId}
      role="region"
      aria-label={title}
      aria-describedby={descId}
      className={cn('space-y-4', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span id={descId} className="sr-only" aria-live="polite" aria-atomic="true">
            {summaryParts.join('. ')}
          </span>
          {(provisional || stale) && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
              provisional && 'bg-warning/10 text-warning border border-warning/30',
              stale && 'bg-destructive/10 text-destructive border border-destructive/30'
            )}>
              <span aria-hidden="true">{provisional ? '⏳' : '⚠️'}</span>
              <span>{provisional ? 'Provisional' : 'Stale'}</span>
            </span>
          )}
        </div>
      </div>

      <div
        id={vizId}
        role={visualizationRole}
        aria-label={visualizationLabel ?? title}
        aria-describedby={descId}
        className={cn(visualizationClassName)}
      >
        {visualization}
      </div>

      {showTable && (
        <div className={cn('overflow-x-auto', tableClassName)}>
          {data.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground" role="status">
              {emptyMessage}
            </div>
          ) : (
            <table
              id={tableId}
              className="w-full text-sm"
              role="table"
              aria-label={tableCaption ?? `${title} data`}
              aria-describedby={descId}
            >
              <caption className="sr-only">{tableCaption ?? `${title} data table`}</caption>
              <thead>
                <tr className="border-b border-border">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        'px-3 py-2 text-left font-medium text-muted-foreground',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                      style={{ textAlign: col.align }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={getKey(item, index)}
                    className={cn('border-b border-border/50', index % 2 === 1 && 'bg-muted/30')}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2 text-foreground',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.className
                        )}
                        style={{ textAlign: col.align }}
                      >
                        {col.render(item, index)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(source || timestamp) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {source && (
            <span className="flex items-center gap-1">
              <span aria-hidden="true">📊</span>
              <span>Source: {source}</span>
            </span>
          )}
          {timestamp && (
            <time dateTime={timestamp} className="flex items-center gap-1">
              <span aria-hidden="true">🕐</span>
              <span>Updated {new Date(timestamp).toLocaleString()}</span>
            </time>
          )}
        </div>
      )}
    </div>
  );
}

export default VisualizationWithTable;