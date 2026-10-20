'use client';

import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormErrorSummaryItem {
  id: string;
  fieldId?: string;
  category?: 'validation' | 'authorization' | 'simulation' | 'server';
  message: string;
}

export interface FormErrorSummaryProps {
  errors: readonly FormErrorSummaryItem[];
  title?: string;
  onNavigateToField?: (fieldId: string) => void;
  className?: string;
}

export const FormErrorSummary = forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  function FormErrorSummary(
    {
      errors,
      title = 'There was a problem with your submission',
      onNavigateToField,
      className = '',
    },
    ref,
  ) {
    if (!errors || errors.length === 0) return null;

    return (
      <div
        ref={ref}
        role="alert"
        tabIndex={-1}
        aria-labelledby="form-error-summary-heading"
        className={cn(
          'p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-xs space-y-2 focus:outline-none focus:ring-2 focus:ring-destructive/40',
          className,
        )}
        data-testid="form-error-summary"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <h2 id="form-error-summary-heading" className="font-semibold text-sm">
            {title}
          </h2>
        </div>

        <ul className="list-disc pl-5 space-y-1 text-foreground/80">
          {errors.map((error) => (
            <li key={error.id}>
              {error.fieldId && onNavigateToField ? (
                <button
                  type="button"
                  onClick={() => onNavigateToField(error.fieldId!)}
                  className="text-left underline hover:text-destructive font-medium cursor-pointer"
                >
                  {error.message}
                </button>
              ) : (
                <span>{error.message}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
