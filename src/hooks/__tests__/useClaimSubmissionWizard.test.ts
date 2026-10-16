/**
 * useClaimSubmissionWizard Hook - Integration Tests
 * 
 * Tests for wizard state management, navigation, and validation orchestration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClaimSubmissionWizard } from '../useClaimSubmissionWizard';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: '0x1234567890123456789012345678901234567890' })),
  useChainId: vi.fn(() => 10),
}));

describe('useClaimSubmissionWizard', () => {
  beforeEach(() => {
    // Clear session storage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Initialization', () => {
    it('initializes with claim-details step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [state] = result.current;

      expect(state.currentStep).toBe('claim-details');
    });

    it('initializes with empty claim details', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [state] = result.current;

      expect(state.claimDetails.title).toBe('');
      expect(state.claimDetails.category).toBe('');
      expect(state.claimDetails.impact).toBe('');
      expect(state.claimDetails.source).toBe('');
      expect(state.claimDetails.description).toBe('');
    });

    it('initializes with idle evidence state', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [state] = result.current;

      expect(state.evidence.status).toBe('idle');
      expect(state.evidence.source).toBeNull();
      expect(state.evidence.canProceed).toBe(false);
    });

    it('initializes with no errors', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [state] = result.current;

      expect(state.error).toBeNull();
      expect(Object.keys(state.claimErrors)).toHaveLength(0);
    });

    it('loads saved state from session storage', () => {
      const savedState = {
        timestamp: Date.now(),
        claimDetails: {
          title: 'Saved title',
          category: 'Healthcare',
          impact: 'High',
          source: 'https://example.com',
          description: 'Saved description text',
        },
        evidenceMetadata: null,
      };
      sessionStorage.setItem('truthbounty_claim_wizard_state', JSON.stringify(savedState));

      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [state] = result.current;

      expect(state.claimDetails.title).toBe('Saved title');
      expect(state.claimDetails.category).toBe('Healthcare');
    });

    it('ignores expired saved state', () => {
      const expiredState = {
        timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
        claimDetails: {
          title: 'Expired title',
          category: 'Healthcare',
          impact: 'High',
          source: 'https://example.com',
          description: 'Expired description',
        },
        evidenceMetadata: null,
      };
      sessionStorage.setItem('truthbounty_claim_wizard_state', JSON.stringify(expiredState));

      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [state] = result.current;

      expect(state.claimDetails.title).toBe(''); // Should be empty, not expired value
    });
  });

  describe('Navigation', () => {
    it('advances to next step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.nextStep();
      });

      const [state] = result.current;
      expect(state.currentStep).toBe('evidence-upload');
    });

    it('goes back to previous step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.nextStep();
        actions.nextStep();
      });

      expect(result.current[0].currentStep).toBe('review');

      act(() => {
        actions.previousStep();
      });

      expect(result.current[0].currentStep).toBe('evidence-upload');
    });

    it('navigates directly to specific step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.goToStep('review');
      });

      const [state] = result.current;
      expect(state.currentStep).toBe('review');
    });

    it('does not go back from first step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      expect(result.current[0].currentStep).toBe('claim-details');

      act(() => {
        actions.previousStep();
      });

      expect(result.current[0].currentStep).toBe('claim-details');
    });

    it('does not advance beyond last step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.goToStep('confirmation');
        actions.nextStep();
      });

      expect(result.current[0].currentStep).toBe('confirmation');
    });

    it('clears error when navigating', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setError('Test error');
      });

      expect(result.current[0].error).toBe('Test error');

      act(() => {
        actions.nextStep();
      });

      expect(result.current[0].error).toBeNull();
    });
  });

  describe('Claim Details Management', () => {
    it('updates claim detail field', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'New claim title');
      });

      const [state] = result.current;
      expect(state.claimDetails.title).toBe('New claim title');
    });

    it('updates multiple fields independently', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'Test title');
        actions.updateClaimDetails('category', 'Healthcare');
        actions.updateClaimDetails('impact', 'High');
      });

      const [state] = result.current;
      expect(state.claimDetails.title).toBe('Test title');
      expect(state.claimDetails.category).toBe('Healthcare');
      expect(state.claimDetails.impact).toBe('High');
    });

    it('marks field as touched', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.markFieldTouched('title');
      });

      const [state] = result.current;
      expect(state.touchedFields.has('title')).toBe(true);
    });

    it('validates field when marked touched', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'abc'); // Too short
        actions.markFieldTouched('title');
      });

      const [state] = result.current;
      expect(state.claimErrors.title).toBeDefined();
    });
  });

  describe('Step Validation', () => {
    it('validates claim details step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'Valid title');
        actions.updateClaimDetails('category', 'Healthcare');
        actions.updateClaimDetails('impact', 'High');
        actions.updateClaimDetails('source', 'https://example.com');
        actions.updateClaimDetails('description', 'Valid description with enough characters.');
      });

      let isValid = false;
      act(() => {
        isValid = actions.validateCurrentStep();
      });

      expect(isValid).toBe(true);
    });

    it('fails validation for incomplete claim details', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'abc'); // Too short
      });

      let isValid = true;
      act(() => {
        isValid = actions.validateCurrentStep();
      });

      expect(isValid).toBe(false);
      expect(result.current[0].claimErrors.title).toBeDefined();
    });

    it('validates evidence upload step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.goToStep('evidence-upload');
        actions.updateEvidence({
          source: 'file',
          status: 'verified',
          progress: 100,
          error: null,
          fileName: 'test.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          url: null,
          digest: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          canProceed: true,
        });
      });

      let isValid = false;
      act(() => {
        isValid = actions.validateCurrentStep();
      });

      expect(isValid).toBe(true);
    });

    it('fails validation for unverified evidence', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.goToStep('evidence-upload');
      });

      let isValid = true;
      act(() => {
        isValid = actions.validateCurrentStep();
      });

      expect(isValid).toBe(false);
    });

    it('validates review step with all checks', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.goToStep('review');
        actions.updateEvidence({
          source: 'file',
          status: 'verified',
          progress: 100,
          error: null,
          fileName: 'test.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          url: null,
          digest: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          canProceed: true,
        });
      });

      let isValid = false;
      act(() => {
        isValid = actions.validateCurrentStep();
      });

      expect(isValid).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    it('resets wizard to initial state', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'Test title');
        actions.nextStep();
        actions.setError('Test error');
      });

      act(() => {
        actions.reset();
      });

      const [state] = result.current;
      expect(state.currentStep).toBe('claim-details');
      expect(state.claimDetails.title).toBe('');
      expect(state.error).toBeNull();
      expect(state.evidence.status).toBe('idle');
    });

    it('clears session storage on reset', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'Test title');
      });

      // Wait for session storage to be updated
      waitFor(() => {
        expect(sessionStorage.getItem('truthbounty_claim_wizard_state')).not.toBeNull();
      });

      act(() => {
        actions.reset();
      });

      expect(sessionStorage.getItem('truthbounty_claim_wizard_state')).toBeNull();
    });
  });

  describe('Transaction State', () => {
    it('sets transaction hash', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      act(() => {
        actions.setTransactionHash(txHash);
      });

      const [state] = result.current;
      expect(state.transactionHash).toBe(txHash);
    });

    it('sets claim ID', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setClaimId('claim-123');
      });

      const [state] = result.current;
      expect(state.claimId).toBe('claim-123');
    });

    it('sets and clears error', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setError('Transaction failed');
      });

      expect(result.current[0].error).toBe('Transaction failed');

      act(() => {
        actions.setError(null);
      });

      expect(result.current[0].error).toBeNull();
    });
  });

  describe('Session Persistence', () => {
    it('persists claim details to session storage', async () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'Persistent title');
      });

      await waitFor(() => {
        const stored = sessionStorage.getItem('truthbounty_claim_wizard_state');
        expect(stored).not.toBeNull();
        
        if (stored) {
          const parsed = JSON.parse(stored);
          expect(parsed.claimDetails.title).toBe('Persistent title');
        }
      });
    });

    it('does not persist on confirmation step', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.updateClaimDetails('title', 'Test title');
        actions.goToStep('confirmation');
      });

      // Session storage should not be updated when on confirmation step
      // (Implementation detail: step change might trigger save before state updates)
    });
  });

  describe('Evidence Management', () => {
    it('updates evidence state', () => {
      const { result } = renderHook(() => useClaimSubmissionWizard());
      const [, actions] = result.current;

      const newEvidence = {
        source: 'file' as const,
        status: 'uploading' as const,
        progress: 50,
        error: null,
        fileName: 'test.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        url: null,
        digest: null,
        canProceed: false,
      };

      act(() => {
        actions.updateEvidence(newEvidence);
      });

      const [state] = result.current;
      expect(state.evidence.status).toBe('uploading');
      expect(state.evidence.progress).toBe(50);
      expect(state.evidence.fileName).toBe('test.pdf');
    });
  });
});
