import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenDispute } from '../OpenDispute';

let mockIsSubmitting = false;

jest.mock('@/lib/contracts/registry', () => ({
  getContractAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
}));

jest.mock('@/hooks/useDisputeContext', () => ({
  useDisputeContext: () => ({ context: null, isLoading: false, error: null }),
}));

jest.mock('@/hooks/useDisputeSubmission', () => ({
  useDisputeSubmission: () => ({
    validateDispute: jest.fn(),
    simulateDispute: jest.fn(),
    isSimulating: false,
    isSubmitting: mockIsSubmitting,
    error: null,
  }),
  formatBondAmount: jest.fn(),
}));

it('keeps the dispute dialog open while submission is pending', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  mockIsSubmitting = true;
  const { rerender } = render(
    <OpenDispute claimId="claim-1" isOpen onClose={onClose} />,
  );

  expect(screen.getByRole('button', { name: 'Close dispute modal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel dispute' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(onClose).not.toHaveBeenCalled();

  mockIsSubmitting = false;
  rerender(<OpenDispute claimId="claim-1" isOpen onClose={onClose} />);
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
});
