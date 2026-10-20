import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocsHome } from '../DocsHome';
import { docsFixture } from '../__fixtures__/docs';

describe('DocsHome', () => {
  it('distinguishes protocol documentation from user guidance', () => {
    render(<DocsHome articles={docsFixture} />);

    expect(screen.getByRole('heading', { name: 'Understand the protocol. Act with evidence.' })).toBeInTheDocument();
    expect(screen.getByText('User guidance')).toBeInTheDocument();
    expect(screen.getByText('Protocol documentation')).toBeInTheDocument();
  });

  it('filters articles by topic and search using keyboard-operable controls', async () => {
    const user = userEvent.setup();
    render(<DocsHome articles={docsFixture} />);

    const claims = screen.getByRole('button', { name: 'Claims' });
    await user.click(claims);
    expect(claims).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Publish claim evidence/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Read transaction states/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All topics' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search documentation' }), 'reorged');
    expect(screen.getByRole('link', { name: /Read transaction states/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Publish claim evidence/ })).not.toBeInTheDocument();
  });

  it('provides an explicit published-content empty state', () => {
    render(<DocsHome articles={[]} />);

    expect(screen.getByRole('status')).toHaveTextContent('No approved documentation is published yet.');
    expect(screen.queryByRole('searchbox')).toBeInTheDocument();
  });

  it('provides a no-results state for a search with no matches', async () => {
    const user = userEvent.setup();
    render(<DocsHome articles={docsFixture} />);

    await user.type(screen.getByRole('searchbox'), 'nothing matches this');
    expect(screen.getByRole('status')).toHaveTextContent('No documentation matches this search.');
  });
});