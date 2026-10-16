/**
 * Claim Submission Wizard Container
 * 
 * 5-step wizard for canonical claim submission:
 * 1. Claim Details (form inputs)
 * 2. Evidence Upload (file or URL)
 * 3. Review (confirmation with fail-closed checks)
 * 4. Transaction (wallet approval + on-chain submission)
 * 5. Confirmation (success/failure with next actions)
 * 
 * Features:
 * - Step indicator with progress
 * - Focus management
 * - Keyboard navigation (Tab, Shift+Tab, Escape)
 * - Screen reader announcements
 * - Session storage persistence
 * - Wallet change invalidation
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useClaimSubmissionWizard, type WizardStep } from '@/hooks/useClaimSubmissionWizard';
import ClaimDetailsStep from './wizard/ClaimDetailsStep';
import EvidenceUploadStep from './wizard/EvidenceUploadStep';
import ReviewStep from './wizard/ReviewStep';
import TransactionStep from './wizard/TransactionStep';
import ConfirmationStep from './wizard/ConfirmationStep';

export interface ClaimSubmissionWizardProps {
  onClose: () => void;
  onSuccess?: (claimId: string) => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  'claim-details': 'Claim Details',
  'evidence-upload': 'Evidence Upload',
  'review': 'Review',
  'transaction': 'Transaction',
  'confirmation': 'Confirmation',
};

const STEP_ORDER: WizardStep[] = [
  'claim-details',
  'evidence-upload',
  'review',
  'transaction',
  'confirmation',
];

export default function ClaimSubmissionWizard({
  onClose,
  onSuccess,
}: ClaimSubmissionWizardProps) {
  const [state, actions] = useClaimSubmissionWizard();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Dialog focus management
  useDialogFocus(true, modalRef, closeButtonRef, onClose);

  // Announce step changes to screen readers
  const previousStepRef = useRef<WizardStep>(state.currentStep);
  useEffect(() => {
    if (previousStepRef.current !== state.currentStep) {
      const stepIndex = STEP_ORDER.indexOf(state.currentStep) + 1;
      const announcement = `Step ${stepIndex} of ${STEP_ORDER.length}: ${STEP_LABELS[state.currentStep]}`;
      
      // Create temporary announcement element
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      announcer.textContent = announcement;
      document.body.appendChild(announcer);
      
      setTimeout(() => document.body.removeChild(announcer), 1000);
      
      previousStepRef.current = state.currentStep;
    }
  }, [state.currentStep]);

  // Handle successful claim creation
  useEffect(() => {
    if (state.currentStep === 'confirmation' && state.claimId && onSuccess) {
      onSuccess(state.claimId);
    }
  }, [state.currentStep, state.claimId, onSuccess]);

  const handleClose = () => {
    // Confirm if user has entered data
    const hasData = state.claimDetails.title.length > 0 || 
                    state.claimDetails.description.length > 0;
    
    if (hasData && state.currentStep !== 'confirmation') {
      if (window.confirm('Are you sure you want to close? Your progress will be saved.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#18181b] border border-[#232329] rounded-lg shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        tabIndex={-1}
      >
        {/* Header with Step Indicator */}
        <div className="sticky top-0 z-10 bg-[#18181b] border-b border-[#232329] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 id="wizard-title" className="text-2xl font-bold text-white">
              Create Claim
            </h2>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-[#232329] transition-colors text-slate-400 hover:text-white"
              aria-label="Close wizard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <nav aria-label="Wizard steps">
            <ol className="flex items-center justify-between gap-2" role="list">
              {STEP_ORDER.map((step, index) => {
                const isCurrent = step === state.currentStep;
                const isCompleted = index < currentStepIndex;
                const isAccessible = index <= currentStepIndex;

                return (
                  <li
                    key={step}
                    className="flex-1"
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <button
                      onClick={() => isAccessible && actions.goToStep(step)}
                      disabled={!isAccessible}
                      className={`
                        w-full text-xs sm:text-sm font-medium py-2 px-1 sm:px-3 rounded-lg transition-colors
                        ${isCurrent 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' 
                          : isCompleted
                          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          : 'bg-[#232329] text-slate-500'}
                        ${!isAccessible && 'cursor-not-allowed opacity-50'}
                      `}
                      aria-label={`${isCompleted ? 'Completed: ' : ''}${STEP_LABELS[step]}`}
                    >
                      <span className="block truncate">
                        {index + 1}. {STEP_LABELS[step]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6">
          {state.currentStep === 'claim-details' && (
            <ClaimDetailsStep
              data={state.claimDetails}
              errors={state.claimErrors}
              touched={state.touchedFields}
              onChange={actions.updateClaimDetails}
              onBlur={actions.markFieldTouched}
              onNext={() => {
                if (actions.validateCurrentStep()) {
                  actions.nextStep();
                }
              }}
              onCancel={handleClose}
            />
          )}

          {state.currentStep === 'evidence-upload' && (
            <EvidenceUploadStep
              evidenceState={state.evidence}
              onEvidenceUpdate={actions.updateEvidence}
              onNext={() => {
                if (actions.validateCurrentStep()) {
                  actions.nextStep();
                }
              }}
              onBack={actions.previousStep}
              onCancel={handleClose}
            />
          )}

          {state.currentStep === 'review' && (
            <ReviewStep
              claimDetails={state.claimDetails}
              evidence={state.evidence}
              onEditDetails={() => actions.goToStep('claim-details')}
              onEditEvidence={() => actions.goToStep('evidence-upload')}
              onSubmit={() => {
                if (actions.validateCurrentStep()) {
                  actions.nextStep();
                }
              }}
              onCancel={handleClose}
              validationError={state.error}
            />
          )}

          {state.currentStep === 'transaction' && (
            <TransactionStep
              claimDetails={state.claimDetails}
              evidence={state.evidence}
              onTransactionHash={actions.setTransactionHash}
              onClaimId={actions.setClaimId}
              onSuccess={() => actions.nextStep()}
              onError={actions.setError}
              onCancel={handleClose}
            />
          )}

          {state.currentStep === 'confirmation' && (
            <ConfirmationStep
              status={state.error ? 'failure' : 'success'}
              claimId={state.claimId}
              transactionHash={state.transactionHash}
              error={state.error}
              onViewClaim={() => {
                if (state.claimId) {
                  window.location.href = `/claims/${state.claimId}`;
                }
              }}
              onCreateAnother={() => {
                actions.reset();
              }}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
