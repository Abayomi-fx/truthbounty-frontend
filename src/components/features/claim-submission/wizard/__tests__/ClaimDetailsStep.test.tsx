/**
 * ClaimDetailsStep Component Tests
 * 
 * Tests for Step 1 of the claim submission wizard
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClaimDetailsStep from '../ClaimDetailsStep';
import type { ClaimFormData, ClaimFormErrors } from '@/lib/claim-submission/validation';

const mockClaimDetails: ClaimFormData = {
  title: '',
  category: '',
  impact: '',
  source: '',
  description: '',
};

const mockErrors: ClaimFormErrors = {};

describe('ClaimDetailsStep', () => {
  const defaultProps = {
    data: mockClaimDetails,
    errors: mockErrors,
    touched: new Set<keyof ClaimFormData>(),
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onNext: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders all form fields', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/impact level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/source url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('displays required indicators', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const requiredIndicators = screen.getAllByText('*');
    expect(requiredIndicators).toHaveLength(5); // All fields required
  });

  it('calls onChange when title input changes', async () => {
    const onChange = vi.fn();
    render(<ClaimDetailsStep {...defaultProps} onChange={onChange} />);

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.type(titleInput, 'New claim title');

    expect(onChange).toHaveBeenCalledWith('title', expect.any(String));
  });

  it('calls onBlur when field loses focus', async () => {
    const onBlur = vi.fn();
    render(<ClaimDetailsStep {...defaultProps} onBlur={onBlur} />);

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.click(titleInput);
    await userEvent.tab(); // Move focus away

    expect(onBlur).toHaveBeenCalledWith('title');
  });

  it('displays error message for touched field with error', () => {
    const errors: ClaimFormErrors = {
      title: 'Title must be at least 5 characters',
    };
    const touched = new Set<keyof ClaimFormData>(['title']);

    render(
      <ClaimDetailsStep
        {...defaultProps}
        errors={errors}
        touched={touched}
      />
    );

    expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
  });

  it('does not display error for untouched field', () => {
    const errors: ClaimFormErrors = {
      title: 'Title must be at least 5 characters',
    };
    const touched = new Set<keyof ClaimFormData>(); // Empty - no fields touched

    render(
      <ClaimDetailsStep
        {...defaultProps}
        errors={errors}
        touched={touched}
      />
    );

    expect(screen.queryByText(/title must be at least 5 characters/i)).not.toBeInTheDocument();
  });

  it('shows character count for title', () => {
    const data: ClaimFormData = {
      ...mockClaimDetails,
      title: 'Test title',
    };

    render(<ClaimDetailsStep {...defaultProps} data={data} />);

    expect(screen.getByText(/10\/200/)).toBeInTheDocument();
  });

  it('shows character count for description', () => {
    const data: ClaimFormData = {
      ...mockClaimDetails,
      description: 'Test description',
    };

    render(<ClaimDetailsStep {...defaultProps} data={data} />);

    expect(screen.getByText(/16\/5000/)).toBeInTheDocument();
  });

  it('highlights character count when near limit', () => {
    const data: ClaimFormData = {
      ...mockClaimDetails,
      title: 'a'.repeat(185), // >90% of 200
    };

    const { container } = render(<ClaimDetailsStep {...defaultProps} data={data} />);

    const charCount = container.querySelector('.text-orange-400');
    expect(charCount).toBeInTheDocument();
  });

  it('renders category dropdown with all options', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.click(categorySelect);

    expect(screen.getByRole('option', { name: /healthcare/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /environment/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /finance/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /technology/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /politics/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /education/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /other/i })).toBeInTheDocument();
  });

  it('renders impact dropdown with all levels', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const impactSelect = screen.getByLabelText(/impact level/i);
    fireEvent.click(impactSelect);

    expect(screen.getByRole('option', { name: /^low$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^medium$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^high$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^critical$/i })).toBeInTheDocument();
  });

  it('disables Next button when form is incomplete', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const nextButton = screen.getByRole('button', { name: /next: evidence upload/i });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next button when form is valid', () => {
    const validData: ClaimFormData = {
      title: 'Valid claim title',
      category: 'Healthcare',
      impact: 'High',
      source: 'https://example.com/evidence',
      description: 'This is a valid description with enough characters to pass validation.',
    };

    render(
      <ClaimDetailsStep
        {...defaultProps}
        data={validData}
        errors={{}}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next: evidence upload/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onNext when Next button clicked', async () => {
    const onNext = vi.fn();
    const validData: ClaimFormData = {
      title: 'Valid claim title',
      category: 'Healthcare',
      impact: 'High',
      source: 'https://example.com/evidence',
      description: 'This is a valid description with enough characters to pass validation.',
    };

    render(
      <ClaimDetailsStep
        {...defaultProps}
        data={validData}
        errors={{}}
        onNext={onNext}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next: evidence upload/i });
    await userEvent.click(nextButton);

    expect(onNext).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button clicked', async () => {
    const onCancel = vi.fn();

    render(<ClaimDetailsStep {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('has proper ARIA attributes for title field', () => {
    const errors: ClaimFormErrors = {
      title: 'Error message',
    };
    const touched = new Set<keyof ClaimFormData>(['title']);

    render(
      <ClaimDetailsStep
        {...defaultProps}
        errors={errors}
        touched={touched}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveAttribute('aria-required', 'true');
    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
  });

  it('has proper ARIA attributes for description field', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const descriptionInput = screen.getByLabelText(/description/i);
    expect(descriptionInput).toHaveAttribute('aria-required', 'true');
    expect(descriptionInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows hint text for fields without errors', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    expect(screen.getByText(/5-200 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/10-5000 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/must be a valid https url/i)).toBeInTheDocument();
  });

  it('accepts valid HTTPS URL in source field', async () => {
    const onChange = vi.fn();
    render(<ClaimDetailsStep {...defaultProps} onChange={onChange} />);

    const sourceInput = screen.getByLabelText(/source url/i);
    await userEvent.type(sourceInput, 'https://example.com/evidence');

    expect(onChange).toHaveBeenCalledWith('source', expect.stringContaining('https://'));
  });

  it('shows placeholder text for inputs', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText(/brief, clear title/i);
    const sourceInput = screen.getByPlaceholderText(/https:\/\/example.com\/evidence/i);
    const descriptionInput = screen.getByPlaceholderText(/provide detailed information/i);

    expect(titleInput).toBeInTheDocument();
    expect(sourceInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  it('enforces maxLength on title input', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput).toHaveAttribute('maxLength', '200');
  });

  it('enforces maxLength on description textarea', () => {
    render(<ClaimDetailsStep {...defaultProps} />);

    const descriptionInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    expect(descriptionInput).toHaveAttribute('maxLength', '5000');
  });

  it('displays error styling for invalid fields', () => {
    const errors: ClaimFormErrors = {
      title: 'Error message',
    };
    const touched = new Set<keyof ClaimFormData>(['title']);

    const { container } = render(
      <ClaimDetailsStep
        {...defaultProps}
        errors={errors}
        touched={touched}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveClass('border-red-500');
  });

  it('shows error icon for invalid fields', () => {
    const errors: ClaimFormErrors = {
      title: 'Error message',
    };
    const touched = new Set<keyof ClaimFormData>(['title']);

    render(
      <ClaimDetailsStep
        {...defaultProps}
        errors={errors}
        touched={touched}
      />
    );

    // AlertCircle icon should be present
    const errorMessage = screen.getByText('Error message').closest('span');
    expect(errorMessage).toHaveClass('text-red-400');
  });
});
