import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IdentifierPasteField } from '../IdentifierPasteField';

function paste(text: string) {
  fireEvent.paste(screen.getByRole('textbox'), {
    clipboardData: { getData: (type: string) => type === 'text' ? text : '' },
  });
}

describe('IdentifierPasteField', () => {
  it('normalizes outer whitespace and only publishes a validated address', async () => {
    const onValueChange = jest.fn();
    render(<IdentifierPasteField kind="address" label="Address" onValueChange={onValueChange} />);
    paste('  0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E\n');
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('0x742D35Cc6634c0532925A3b844BC9E7595f0eB1e'));
    expect(onValueChange).toHaveBeenCalledWith('0x742D35Cc6634c0532925A3b844BC9E7595f0eB1e');
  });

  it('rejects a wrong-chain address without inserting it', async () => {
    render(<IdentifierPasteField kind="address" label="Address" expectedChainId={10} currentChainId={1} />);
    paste('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E');
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('different network'));
  });

  it('rejects a paste containing confusables or hidden injection characters', async () => {
    render(<IdentifierPasteField kind="claim-id" label="Claim ID" />);
    paste('42\u202e<script>');
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unsupported Unicode or hidden characters'));
  });
});
