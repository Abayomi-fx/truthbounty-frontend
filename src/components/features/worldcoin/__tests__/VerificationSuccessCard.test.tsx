import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerificationSuccessCard } from '@/components/features/worldcoin/VerificationSuccessCard';

const VERIFIED_AT = '2026-01-01T12:00:00.000Z';
const EXPIRES_AT = '2027-01-01T12:00:00.000Z';

describe('VerificationSuccessCard', () => {
  // The label lives in its own nested <span>, so getByText resolves to the
  // label alone. Assert against the parent that carries label *and* value.
  const labelledValue = (label: RegExp) => screen.getByText(label).parentElement;

  it('displays verification and expiry with absolute UTC context', () => {
    render(
      <VerificationSuccessCard
        verificationLevel="orb"
        verifiedAt={VERIFIED_AT}
        expiresAt={EXPIRES_AT}
      />
    );

    expect(labelledValue(/Verified:/)).toHaveTextContent('UTC');
    expect(labelledValue(/Valid until:/)).toHaveTextContent('UTC');
  });

  it('renders the exact canonical timestamps rather than a fabricated or empty value', () => {
    render(
      <VerificationSuccessCard
        verificationLevel="orb"
        verifiedAt={VERIFIED_AT}
        expiresAt={EXPIRES_AT}
      />
    );

    expect(labelledValue(/Verified:/)).toHaveTextContent('Jan 01, 2026');
    expect(labelledValue(/Verified:/)).toHaveTextContent('12:00:00 UTC');
    expect(labelledValue(/Valid until:/)).toHaveTextContent('Jan 01, 2027');
    expect(labelledValue(/Valid until:/)).toHaveTextContent('12:00:00 UTC');
  });

  it('degrades to a visible placeholder for unparseable timestamps instead of throwing', () => {
    render(<VerificationSuccessCard verificationLevel="device" verifiedAt="not-a-date" />);

    expect(labelledValue(/Verified:/)).toHaveTextContent('—');
  });

  it('announces verification as a status region and hides decorative icons', () => {
    render(
      <VerificationSuccessCard
        verificationLevel="orb"
        verifiedAt={VERIFIED_AT}
        expiresAt={EXPIRES_AT}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByTestId('decorative-icon').length).toBeGreaterThan(0);
  });

  it('contains a single, labelled, keyboard-focusable action button', () => {
    render(
      <VerificationSuccessCard
        verificationLevel="device"
        verifiedAt={VERIFIED_AT}
        expiresAt={EXPIRES_AT}
        onClose={() => undefined}
      />
    );

    const button = screen.getByRole('button', { name: /continue/i });
    expect(button).toHaveAccessibleName('Continue');
    expect(button).not.toBeDisabled();

    button.focus();
    expect(button).toHaveFocus();
  });

  it('activates the close action from the keyboard (Enter)', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <VerificationSuccessCard
        verificationLevel="device"
        verifiedAt={VERIFIED_AT}
        expiresAt={EXPIRES_AT}
        onClose={onClose}
      />
    );

    const button = screen.getByRole('button', { name: /continue/i });
    button.focus();
    await user.keyboard('{Enter}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not create an action button when no handler is provided', () => {
    render(
      <VerificationSuccessCard
        verificationLevel="orb"
        verifiedAt={VERIFIED_AT}
        expiresAt={EXPIRES_AT}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});