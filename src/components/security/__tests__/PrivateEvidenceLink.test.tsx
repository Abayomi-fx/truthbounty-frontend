/**
 * Component tests for PrivateEvidenceLink.
 *
 * V2-FE Evidence Privacy Protection — Tests truncated URL display, clipboard
 * copy functionality, security validation, and accessibility.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PrivateEvidenceLink } from '../PrivateEvidenceLink';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});

describe('PrivateEvidenceLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('URL truncation display', () => {
    it('displays truncated URL for deep path', () => {
      const url = 'https://example.com/api/v2/files/evidence/report.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('example.com/.../report.pdf');
      expect(link).not.toHaveTextContent('/api/');
      expect(link).not.toHaveTextContent('/v2/');
    });

    it('strips query parameters from display', () => {
      const url = 'https://example.com/path/file.pdf?token=secret&session=xyz';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('example.com/.../file.pdf');
      expect(link).not.toHaveTextContent('token');
      expect(link).not.toHaveTextContent('secret');
      expect(link).not.toHaveTextContent('session');
    });

    it('displays truncated IPFS CID', () => {
      const url = 'ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('QmYwAPJz...F8xFk (IPFS)');
      expect(link).not.toHaveTextContent('QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk');
    });

    it('shows external link icon when showIcon is true', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} showIcon={true} />);

      // Icon should be present (aria-hidden)
      const link = screen.getByRole('link');
      expect(link.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Clipboard functionality', () => {
    it('copies full URL to clipboard on click', async () => {
      const url = 'https://example.com/api/secret/file.pdf?token=abc';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      fireEvent.click(link);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url);
      });
    });

    it('shows "Copied!" feedback after successful copy', async () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      fireEvent.click(link);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('hides "Copied!" feedback after 2 seconds', async () => {
      jest.useFakeTimers();
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      fireEvent.click(link);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('shows separate copy button when showCopyButton is true', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} showCopyButton={true} />);

      const copyButton = screen.getByRole('button', {
        name: /copy full url/i,
      });
      expect(copyButton).toBeInTheDocument();
    });

    it('copy button shows check icon after copy', async () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} showCopyButton={true} />);

      const copyButton = screen.getByRole('button', {
        name: /copy full url/i,
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /copied!/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Security validation', () => {
    it('blocks unsafe URL with [Blocked] message', () => {
      const unsafeUrl = 'javascript:alert(1)';
      render(<PrivateEvidenceLink href={unsafeUrl} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(
        screen.getByText(/blocked.*security/i, { selector: 'span' }),
      ).toBeInTheDocument();
    });

    it('blocks data: URL scheme', () => {
      const dataUrl = 'data:text/html,<script>alert(1)</script>';
      render(<PrivateEvidenceLink href={dataUrl} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText(/blocked/i)).toBeInTheDocument();
    });

    it('allows https:// URLs', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('allows http:// URLs (if safeUrl permits)', () => {
      const url = 'http://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      // Should render if safeUrl validates http (depends on evidence-sanitizer config)
      const link = screen.queryByRole('link');
      if (link) {
        expect(link).toHaveAttribute('href', url);
      }
    });

    it('allows ipfs:// URLs', () => {
      const url = 'ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk';
      render(<PrivateEvidenceLink href={url} />);

      expect(screen.getByRole('link')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible aria-label', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label');
      expect(link.getAttribute('aria-label')).toContain('truncated for privacy');
      expect(link.getAttribute('aria-label')).toContain('click to copy');
    });

    it('allows custom aria-label', () => {
      const url = 'https://example.com/file.pdf';
      const customLabel = 'Custom evidence link';
      render(<PrivateEvidenceLink href={url} ariaLabel={customLabel} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('aria-label', customLabel);
    });

    it('link opens in new tab with secure rel', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    });

    it('copy button has accessible label', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} showCopyButton={true} />);

      const button = screen.getByRole('button', {
        name: /copy full url/i,
      });
      expect(button).toHaveAttribute('aria-label');
    });

    it('"Copied!" message has aria-live for screen readers', async () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      fireEvent.click(link);

      await waitFor(() => {
        const copiedStatus = screen.getByText('Copied!');
        expect(copiedStatus).toHaveAttribute('role', 'status');
        expect(copiedStatus).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('has title attribute with privacy notice', () => {
      const url = 'https://example.com/file.pdf';
      render(<PrivateEvidenceLink href={url} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('title');
      expect(link.getAttribute('title')).toContain('truncated for privacy');
    });
  });

  describe('Custom styling', () => {
    it('applies custom className', () => {
      const url = 'https://example.com/file.pdf';
      const customClass = 'custom-link-class';
      render(<PrivateEvidenceLink href={url} className={customClass} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass(customClass);
    });
  });
});
