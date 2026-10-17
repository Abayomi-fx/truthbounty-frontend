import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopyableValue } from '../CopyableValue';

describe('CopyableValue', () => {
  it('shows truncated text but copies and identifies the full value', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
    render(<CopyableValue kind="address" value={address} displayValue="0x742d…eB1E" label="address" />);

    expect(screen.getByText('0x742d…eB1E')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: `Copy full address: ${address}` });
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith(address);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Only public identifiers should be copied'));
  });

  it('announces when clipboard access is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<CopyableValue kind="support-reference" value="REF-42" label="support reference" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy full support reference: REF-42' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Clipboard access was denied'));
  });
});
