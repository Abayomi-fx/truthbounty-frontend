import { render, screen } from '@testing-library/react';
import { DocsArticle } from '../DocsArticle';
import { docsFixture } from '../__fixtures__/docs';

describe('DocsArticle', () => {
  it('renders review metadata, source, table of contents, and boundary copy', () => {
    render(
      <DocsArticle
        article={docsFixture[0]}
        relatedArticles={[docsFixture[1]]}
        previousArticle={docsFixture[1]}
        nextArticle={docsFixture[1]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Read transaction states' })).toBeInTheDocument();
    expect(screen.getByText('Version 2.0')).toBeInTheDocument();
    expect(screen.getByText('Reviewed 09 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Applies to TB-V2')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toHaveTextContent('Before you start');
    expect(screen.getByRole('link', { name: /opens github\.com in a new tab/ })).toHaveAttribute('href', 'https://github.com/DigiNodes/truthbounty-protocol');
    expect(screen.getByRole('heading', { name: 'Related content' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Article pagination' })).toBeInTheDocument();
    expect(screen.getByText('Feedback is not collected here and this page does not provide support resolution.')).toBeInTheDocument();
  });

  it('renders untrusted article text as escaped text, never HTML', () => {
    const hostileArticle = {
      ...docsFixture[0],
      title: '<img src=x onerror=alert(1)>',
      blocks: [{ type: 'paragraph' as const, text: '<script>alert(1)</script>' }],
    };

    render(<DocsArticle article={hostileArticle} relatedArticles={[]} />);

    expect(screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});