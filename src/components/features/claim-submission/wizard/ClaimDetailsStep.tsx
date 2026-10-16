/**
 * Claim Details Step (Step 1 of 5)
 * 
 * Form for entering claim information:
 * - Title (5-200 chars)
 * - Category (predefined list)
 * - Impact (Low/Medium/High/Critical)
 * - Source URL (HTTPS only)
 * - Description (10-5000 chars)
 * 
 * Features:
 * - Progressive validation on blur
 * - Accessible labels and error messages
 * - Character count indicators
 * - Disabled submit when invalid
 */

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { ClaimFormData, ClaimFormErrors } from '@/lib/claim-submission/validation';
import { 
  PREDEFINED_CATEGORIES, 
  PREDEFINED_IMPACTS,
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/lib/claim-submission/validation';

export interface ClaimDetailsStepProps {
  data: ClaimFormData;
  errors: ClaimFormErrors;
  touched: Set<keyof ClaimFormData>;
  onChange: (field: keyof ClaimFormData, value: string) => void;
  onBlur: (field: keyof ClaimFormData) => void;
  onNext: () => void;
  onCancel: () => void;
}

export default function ClaimDetailsStep({
  data,
  errors,
  touched,
  onChange,
  onBlur,
  onNext,
  onCancel,
}: ClaimDetailsStepProps) {
  const hasErrors = Object.keys(errors).length > 0;
  const canProceed = !hasErrors && 
    data.title.length >= TITLE_MIN_LENGTH &&
    data.category.length > 0 &&
    data.impact.length > 0 &&
    data.source.length > 0 &&
    data.description.length >= DESCRIPTION_MIN_LENGTH;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Claim Details
        </h3>
        <p className="text-sm text-slate-400">
          Provide the details of your claim. All fields are required.
        </p>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="claim-title" className="block text-sm font-medium text-slate-200 mb-2">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="claim-title"
          type="text"
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          onBlur={() => onBlur('title')}
          maxLength={TITLE_MAX_LENGTH}
          className={`
            w-full px-4 py-2 bg-[#232329] border rounded-lg
            text-white placeholder-slate-500
            focus:outline-none focus:ring-2
            ${touched.has('title') && errors.title
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-[#2a2a32] focus:ring-orange-500/50'}
          `}
          placeholder="Brief, clear title for your claim"
          aria-required="true"
          aria-invalid={touched.has('title') && !!errors.title}
          aria-describedby={touched.has('title') && errors.title ? 'title-error' : 'title-hint'}
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          {touched.has('title') && errors.title ? (
            <span id="title-error" className="text-red-400 flex items-center gap-1" role="alert">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {errors.title}
            </span>
          ) : (
            <span id="title-hint" className="text-slate-500">
              {TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH} characters
            </span>
          )}
          <span className={`${data.title.length > TITLE_MAX_LENGTH * 0.9 ? 'text-orange-400' : 'text-slate-500'}`}>
            {data.title.length}/{TITLE_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="claim-category" className="block text-sm font-medium text-slate-200 mb-2">
          Category <span className="text-red-400">*</span>
        </label>
        <select
          id="claim-category"
          value={data.category}
          onChange={(e) => onChange('category', e.target.value)}
          onBlur={() => onBlur('category')}
          className={`
            w-full px-4 py-2 bg-[#232329] border rounded-lg
            text-white
            focus:outline-none focus:ring-2
            ${touched.has('category') && errors.category
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-[#2a2a32] focus:ring-orange-500/50'}
          `}
          aria-required="true"
          aria-invalid={touched.has('category') && !!errors.category}
          aria-describedby={touched.has('category') && errors.category ? 'category-error' : undefined}
        >
          <option value="">Select a category</option>
          {PREDEFINED_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {touched.has('category') && errors.category && (
          <span id="category-error" className="mt-1 text-xs text-red-400 flex items-center gap-1" role="alert">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {errors.category}
          </span>
        )}
      </div>

      {/* Impact */}
      <div>
        <label htmlFor="claim-impact" className="block text-sm font-medium text-slate-200 mb-2">
          Impact Level <span className="text-red-400">*</span>
        </label>
        <select
          id="claim-impact"
          value={data.impact}
          onChange={(e) => onChange('impact', e.target.value)}
          onBlur={() => onBlur('impact')}
          className={`
            w-full px-4 py-2 bg-[#232329] border rounded-lg
            text-white
            focus:outline-none focus:ring-2
            ${touched.has('impact') && errors.impact
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-[#2a2a32] focus:ring-orange-500/50'}
          `}
          aria-required="true"
          aria-invalid={touched.has('impact') && !!errors.impact}
          aria-describedby={touched.has('impact') && errors.impact ? 'impact-error' : 'impact-hint'}
        >
          <option value="">Select impact level</option>
          {PREDEFINED_IMPACTS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {touched.has('impact') && errors.impact ? (
          <span id="impact-error" className="mt-1 text-xs text-red-400 flex items-center gap-1" role="alert">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {errors.impact}
          </span>
        ) : (
          <span id="impact-hint" className="mt-1 text-xs text-slate-500">
            Estimate the severity of this issue
          </span>
        )}
      </div>

      {/* Source URL */}
      <div>
        <label htmlFor="claim-source" className="block text-sm font-medium text-slate-200 mb-2">
          Source URL <span className="text-red-400">*</span>
        </label>
        <input
          id="claim-source"
          type="url"
          value={data.source}
          onChange={(e) => onChange('source', e.target.value)}
          onBlur={() => onBlur('source')}
          className={`
            w-full px-4 py-2 bg-[#232329] border rounded-lg
            text-white placeholder-slate-500
            focus:outline-none focus:ring-2
            ${touched.has('source') && errors.source
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-[#2a2a32] focus:ring-orange-500/50'}
          `}
          placeholder="https://example.com/evidence"
          aria-required="true"
          aria-invalid={touched.has('source') && !!errors.source}
          aria-describedby={touched.has('source') && errors.source ? 'source-error' : 'source-hint'}
        />
        {touched.has('source') && errors.source ? (
          <span id="source-error" className="mt-1 text-xs text-red-400 flex items-center gap-1" role="alert">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {errors.source}
          </span>
        ) : (
          <span id="source-hint" className="mt-1 text-xs text-slate-500">
            Must be a valid HTTPS URL
          </span>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="claim-description" className="block text-sm font-medium text-slate-200 mb-2">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          id="claim-description"
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          onBlur={() => onBlur('description')}
          rows={6}
          maxLength={DESCRIPTION_MAX_LENGTH}
          className={`
            w-full px-4 py-2 bg-[#232329] border rounded-lg
            text-white placeholder-slate-500
            focus:outline-none focus:ring-2 resize-none
            ${touched.has('description') && errors.description
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-[#2a2a32] focus:ring-orange-500/50'}
          `}
          placeholder="Provide detailed information about your claim..."
          aria-required="true"
          aria-invalid={touched.has('description') && !!errors.description}
          aria-describedby={touched.has('description') && errors.description ? 'description-error' : 'description-hint'}
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          {touched.has('description') && errors.description ? (
            <span id="description-error" className="text-red-400 flex items-center gap-1" role="alert">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {errors.description}
            </span>
          ) : (
            <span id="description-hint" className="text-slate-500">
              {DESCRIPTION_MIN_LENGTH}-{DESCRIPTION_MAX_LENGTH} characters
            </span>
          )}
          <span className={`${data.description.length > DESCRIPTION_MAX_LENGTH * 0.9 ? 'text-orange-400' : 'text-slate-500'}`}>
            {data.description.length}/{DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[#232329]">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`
            px-6 py-2 text-sm font-medium rounded-lg transition-colors
            ${canProceed
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-[#232329] text-slate-500 cursor-not-allowed'}
          `}
        >
          Next: Evidence Upload
        </button>
      </div>
    </div>
  );
}
