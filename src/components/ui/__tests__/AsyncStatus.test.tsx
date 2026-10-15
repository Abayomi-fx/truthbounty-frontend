import { render, screen } from '@testing-library/react';
import { AsyncStatus } from '../AsyncStatus';

describe('AsyncStatus', () => {
  it.each(['loading', 'empty', 'stale', 'success'] as const)(
    'announces %s as a polite status',
    (status) => {
      render(<AsyncStatus status={status} message={`${status} data`} />);

      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    },
  );

  it('marks loading data as busy', () => {
    render(<AsyncStatus status="loading" message="Loading claims" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('announces errors assertively', () => {
    render(<AsyncStatus status="error" message="Claims unavailable" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Claims unavailable');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces failed projection reads assertively', () => {
    render(<AsyncStatus status="failed" message="Claims unavailable" />);

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('does not announce idle state', () => {
    render(<AsyncStatus status="idle" message="Not started" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
