/**
 * Component tests for PrivateTimestamp.
 *
 * V2-FE Evidence Privacy Protection — Tests relative timestamp display for
 * privacy-preserving temporal generalization.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PrivateTimestamp } from '../PrivateTimestamp';

// Mock formatRelativeTime to control output
jest.mock('@/lib/security/evidence-privacy', () => ({
  formatRelativeTime: jest.fn((timestamp) => {
    const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date('2026-09-27T14:00:00Z');
    const diffMs = now.getTime() - ts.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return { display: '~30m ago', value: 30, unit: 'm', isDateOnly: false };
    } else if (diffHours < 24) {
      return {
        display: `~${diffHours}h ago`,
        value: diffHours,
        unit: 'h',
        isDateOnly: false,
      };
    } else {
      return {
        display: '2026-09-20',
        value: 7,
        unit: 'd',
        isDateOnly: true,
      };
    }
  }),
}));

describe('PrivateTimestamp', () => {
  it('displays relative time format', () => {
    const timestamp = '2026-09-27T12:00:00Z'; // 2h ago
    render(<PrivateTimestamp timestamp={timestamp} />);

    const time = screen.getByText('~2h ago');
    expect(time).toBeInTheDocument();
    expect(time.tagName).toBe('TIME');
  });

  it('accepts Date object as timestamp', () => {
    const timestamp = new Date('2026-09-27T12:00:00Z');
    render(<PrivateTimestamp timestamp={timestamp} />);

    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('includes prefix when provided', () => {
    const timestamp = '2026-09-27T12:00:00Z';
    render(<PrivateTimestamp timestamp={timestamp} prefix="Submitted" />);

    expect(screen.getByText(/Submitted.*ago/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const timestamp = '2026-09-27T12:00:00Z';
    const customClass = 'custom-timestamp';
    const { container } = render(
      <PrivateTimestamp timestamp={timestamp} className={customClass} />,
    );

    const time = container.querySelector('time');
    expect(time).toHaveClass(customClass);
  });

  it('sets dateTime attribute with ISO timestamp', () => {
    const timestamp = '2026-09-27T12:00:00Z';
    render(<PrivateTimestamp timestamp={timestamp} />);

    const time = screen.getByText(/ago/);
    expect(time).toHaveAttribute('dateTime', timestamp);
  });

  it('has accessible aria-label', () => {
    const timestamp = '2026-09-27T12:00:00Z';
    render(<PrivateTimestamp timestamp={timestamp} prefix="Created" />);

    const time = screen.getByText(/ago/);
    expect(time).toHaveAttribute('aria-label');
    expect(time.getAttribute('aria-label')).toContain('Created');
  });

  it('hides exact timestamp in title by default for privacy', () => {
    const timestamp = '2026-09-27T12:00:00Z';
    render(<PrivateTimestamp timestamp={timestamp} showTooltip={false} />);

    const time = screen.getByText(/ago/);
    expect(time).not.toHaveAttribute('title');
  });

  it('shows privacy-aware tooltip when showTooltip is true', () => {
    const timestamp = '2026-09-27T12:00:00Z';
    render(<PrivateTimestamp timestamp={timestamp} showTooltip={true} />);

    const time = screen.getByText(/ago/);
    expect(time).toHaveAttribute('title');
    expect(time.getAttribute('title')).toContain('Approximately');
    expect(time.getAttribute('title')).toContain('privacy');
  });

  it('displays date-only format for old timestamps', () => {
    const timestamp = '2026-08-01T12:00:00Z'; // > 4 weeks ago
    render(<PrivateTimestamp timestamp={timestamp} />);

    // Mock returns date format for old timestamps
    expect(screen.getByText('2026-09-20')).toBeInTheDocument();
  });

  it('handles recent timestamps (< 1 hour)', () => {
    const timestamp = '2026-09-27T13:30:00Z'; // 30m ago
    render(<PrivateTimestamp timestamp={timestamp} />);

    expect(screen.getByText('~30m ago')).toBeInTheDocument();
  });
});
