import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from '../../../__tests__/utils/axe';
import { RpcHealthBanner } from '../RpcHealthBanner';
import type { RpcHealthPresentation } from '@/lib/rpc-health';

function presentation(
  overrides: Partial<RpcHealthPresentation> = {},
): RpcHealthPresentation {
  return {
    state: 'primary',
    label: 'RPC primary healthy',
    tone: 'success',
    role: 'status',
    ariaLive: 'polite',
    message: 'Primary RPC is responding on the expected chain and release.',
    recoveryAction: 'none',
    recoveryLabel: null,
    quorumSummary: '3 of 3 reviewed providers agree',
    mutationSummary: 'Mutations available',
    ...overrides,
  };
}

describe('RpcHealthBanner', () => {
  it('renders a polite status for healthy quorum', () => {
    render(<RpcHealthBanner presentation={presentation()} />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('data-rpc-health-state', 'primary');
    expect(screen.getByText('RPC primary healthy')).toBeInTheDocument();
    expect(screen.getByText('Mutations available')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an assertive alert with bounded recovery action when quorum is unavailable', () => {
    const onRetry = jest.fn();
    render(
      <RpcHealthBanner
        presentation={presentation({
          state: 'unavailable',
          label: 'RPC unavailable',
          tone: 'danger',
          role: 'alert',
          ariaLive: 'assertive',
          message:
            'No reviewed RPC provider can satisfy quorum. Mutations are blocked. Retry when providers recover.',
          recoveryAction: 'retry',
          recoveryLabel: 'Retry health check',
          quorumSummary: '0 of 3 reviewed providers agree',
          mutationSummary: 'Mutations blocked',
        })}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Mutations blocked')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry health check' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations for healthy and unavailable states', async () => {
    const healthy = render(<RpcHealthBanner presentation={presentation()} />);
    expect(await axe(healthy.container)).toHaveNoViolations();
    healthy.unmount();

    const blocked = render(
      <RpcHealthBanner
        presentation={presentation({
          state: 'unavailable',
          label: 'RPC unavailable',
          tone: 'danger',
          role: 'alert',
          ariaLive: 'assertive',
          message: 'Mutations are blocked.',
          recoveryAction: 'retry',
          recoveryLabel: 'Retry health check',
          quorumSummary: '0 of 3 reviewed providers agree',
          mutationSummary: 'Mutations blocked',
        })}
        onRetry={() => {}}
      />,
    );
    expect(await axe(blocked.container)).toHaveNoViolations();
  });
});
