import { fireEvent, render, screen } from '@testing-library/react';
import { DocsRouteError } from '../DocsRouteError';

describe('DocsRouteError', () => {
  it('offers a retry without collecting data or claiming support resolution', () => {
    const reset = jest.fn();
    render(<DocsRouteError reset={reset} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Documentation is temporarily unavailable.');
    expect(screen.getByRole('alert')).toHaveTextContent('No article content was submitted or stored.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});