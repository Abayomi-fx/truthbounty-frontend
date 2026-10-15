/**
 * Claim Submission Wizard State Management Hook
 * 
 * Manages wizard flow, step transitions, validation, and session persistence.
 * Integrates validation utilities and evidence handling from lib/claim-submission.
 * 
 * Fail-closed: Blocks progression when validation fails or wallet disconnected.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount as useWagmiAccount, useChainId } from 'wagmi';
import type { Address, Hex } from 'viem';
import {
  validateClaimDetails,
  validateWalletConnected,
  validateChainMatch,
  type ClaimFormData,
  type ClaimFormErrors,
} from '@/lib/claim-submission/validation';
import {
  createEvidenceState,
  invalidateEvidence,
  isEvidenceTerminal,
  loadEvidenceFromStorage,
  saveEvidenceToStorage,
  clearEvidenceStorage,
  type EvidenceState,
} from '@/lib/claim-submission/evidence';

export type WizardStep = 
  | 'claim-details' 
  | 'evidence-upload' 
  | 'review' 
  | 'transaction' 
  | 'confirmation';

export interface WizardState {
  currentStep: WizardStep;
  claimDetails: ClaimFormData;
  claimErrors: ClaimFormErrors;
  touchedFields: Set<keyof ClaimFormData>;
  evidence: EvidenceState;
  transactionHash: Hex | null;
  claimId: string | null;
  error: string | null;
}

export interface WizardActions {
  // Navigation
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
  
  // Claim details
  updateClaimDetails: (field: keyof ClaimFormData, value: string) => void;
  markFieldTouched: (field: keyof ClaimFormData) => void;
  validateCurrentStep: () => boolean;
  
  // Evidence
  updateEvidence: (state: EvidenceState) => void;
  
  // Transaction
  setTransactionHash: (hash: Hex) => void;
  setClaimId: (id: string) => void;
  setError: (error: string | null) => void;
}

const INITIAL_CLAIM_DETAILS: ClaimFormData = {
  title: '',
  category: '',
  impact: '',
  source: '',
  description: '',
};

const STORAGE_KEY = 'truthbounty_claim_wizard_state';
const STORAGE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface StoredState {
  timestamp: number;
  claimDetails: ClaimFormData;
  evidenceMetadata: {
    source: EvidenceState['source'];
    status: EvidenceState['status'];
    fileName: EvidenceState['fileName'];
    fileSize: EvidenceState['fileSize'];
    fileType: EvidenceState['fileType'];
    url: EvidenceState['url'];
  } | null;
}

function saveWizardState(claimDetails: ClaimFormData, evidence: EvidenceState) {
  try {
    const stored: StoredState = {
      timestamp: Date.now(),
      claimDetails,
      evidenceMetadata: evidence.source ? {
        source: evidence.source,
        status: evidence.status,
        fileName: evidence.fileName,
        fileSize: evidence.fileSize,
        fileType: evidence.fileType,
        url: evidence.url,
      } : null,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    // Silent failure - session storage might be disabled
    console.warn('Failed to save wizard state:', error);
  }
}

function loadWizardState(): { claimDetails: ClaimFormData; evidence: Partial<EvidenceState> } | null {
  try {
    const item = sessionStorage.getItem(STORAGE_KEY);
    if (!item) return null;

    const stored: StoredState = JSON.parse(item);
    
    // Check TTL
    if (Date.now() - stored.timestamp > STORAGE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      claimDetails: stored.claimDetails,
      evidence: stored.evidenceMetadata || {},
    };
  } catch (error) {
    console.warn('Failed to load wizard state:', error);
    return null;
  }
}

function clearWizardState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    clearEvidenceStorage();
  } catch (error) {
    console.warn('Failed to clear wizard state:', error);
  }
}

export function useClaimSubmissionWizard(): [WizardState, WizardActions] {
  // Wallet state
  const { address } = useWagmiAccount();
  const chainId = useChainId();
  const previousAddressRef = useRef<Address | undefined>(address);
  const previousChainIdRef = useRef<number | undefined>(chainId);

  // Load initial state from session storage
  const [state, setState] = useState<WizardState>(() => {
    const stored = loadWizardState();
    if (stored) {
      return {
        currentStep: 'claim-details' as WizardStep,
        claimDetails: stored.claimDetails,
        claimErrors: {},
        touchedFields: new Set(),
        evidence: {
          ...createEvidenceState(),
          ...stored.evidence,
        },
        transactionHash: null,
        claimId: null,
        error: null,
      };
    }

    return {
      currentStep: 'claim-details',
      claimDetails: INITIAL_CLAIM_DETAILS,
      claimErrors: {},
      touchedFields: new Set(),
      evidence: createEvidenceState(),
      transactionHash: null,
      claimId: null,
      error: null,
    };
  });

  // Persist state to session storage on changes
  useEffect(() => {
    if (state.currentStep !== 'confirmation') {
      saveWizardState(state.claimDetails, state.evidence);
    }
  }, [state.claimDetails, state.evidence, state.currentStep]);

  // Wallet change detection -> invalidate evidence
  useEffect(() => {
    const addressChanged = previousAddressRef.current !== undefined && 
                           previousAddressRef.current !== address;
    const chainChanged = previousChainIdRef.current !== undefined && 
                         previousChainIdRef.current !== chainId;

    if ((addressChanged || chainChanged) && !isEvidenceTerminal(state.evidence)) {
      setState(prev => ({
        ...prev,
        evidence: invalidateEvidence(prev.evidence),
        error: 'Wallet changed. Please re-verify evidence.',
      }));
    }

    previousAddressRef.current = address;
    previousChainIdRef.current = chainId;
  }, [address, chainId, state.evidence]);

  // Actions
  const actions: WizardActions = {
    goToStep: useCallback((step: WizardStep) => {
      setState(prev => ({ ...prev, currentStep: step, error: null }));
    }, []),

    nextStep: useCallback(() => {
      setState(prev => {
        const steps: WizardStep[] = ['claim-details', 'evidence-upload', 'review', 'transaction', 'confirmation'];
        const currentIndex = steps.indexOf(prev.currentStep);
        if (currentIndex < steps.length - 1) {
          return { ...prev, currentStep: steps[currentIndex + 1], error: null };
        }
        return prev;
      });
    }, []),

    previousStep: useCallback(() => {
      setState(prev => {
        const steps: WizardStep[] = ['claim-details', 'evidence-upload', 'review', 'transaction', 'confirmation'];
        const currentIndex = steps.indexOf(prev.currentStep);
        if (currentIndex > 0) {
          return { ...prev, currentStep: steps[currentIndex - 1], error: null };
        }
        return prev;
      });
    }, []),

    reset: useCallback(() => {
      clearWizardState();
      setState({
        currentStep: 'claim-details',
        claimDetails: INITIAL_CLAIM_DETAILS,
        claimErrors: {},
        touchedFields: new Set(),
        evidence: createEvidenceState(),
        transactionHash: null,
        claimId: null,
        error: null,
      });
    }, []),

    updateClaimDetails: useCallback((field: keyof ClaimFormData, value: string) => {
      setState(prev => ({
        ...prev,
        claimDetails: {
          ...prev.claimDetails,
          [field]: value,
        },
      }));
    }, []),

    markFieldTouched: useCallback((field: keyof ClaimFormData) => {
      setState(prev => {
        const newTouched = new Set(prev.touchedFields);
        newTouched.add(field);
        
        // Validate the specific field
        const validation = validateClaimDetails(prev.claimDetails);
        
        return {
          ...prev,
          touchedFields: newTouched,
          claimErrors: validation.errors,
        };
      });
    }, []),

    validateCurrentStep: useCallback(() => {
      const { currentStep, claimDetails, evidence } = state;

      switch (currentStep) {
        case 'claim-details': {
          const validation = validateClaimDetails(claimDetails);
          setState(prev => ({
            ...prev,
            claimErrors: validation.errors,
            touchedFields: new Set(['title', 'category', 'impact', 'source', 'description']),
          }));
          return validation.valid;
        }

        case 'evidence-upload': {
          return evidence.canProceed;
        }

        case 'review': {
          // Fail-closed checks
          const walletCheck = validateWalletConnected(address);
          if (!walletCheck.valid) {
            setState(prev => ({ ...prev, error: walletCheck.error }));
            return false;
          }

          const expectedChainId = Number(process.env.NEXT_PUBLIC_EXPECTED_CHAIN_ID || 10);
          const chainCheck = validateChainMatch(chainId, expectedChainId);
          if (!chainCheck.valid) {
            setState(prev => ({ ...prev, error: chainCheck.error }));
            return false;
          }

          if (!evidence.canProceed) {
            setState(prev => ({ ...prev, error: 'Evidence not verified' }));
            return false;
          }

          return true;
        }

        default:
          return true;
      }
    }, [state, address, chainId]),

    updateEvidence: useCallback((evidenceState: EvidenceState) => {
      setState(prev => ({ ...prev, evidence: evidenceState }));
    }, []),

    setTransactionHash: useCallback((hash: Hex) => {
      setState(prev => ({ ...prev, transactionHash: hash }));
    }, []),

    setClaimId: useCallback((id: string) => {
      setState(prev => ({ ...prev, claimId: id }));
    }, []),

    setError: useCallback((error: string | null) => {
      setState(prev => ({ ...prev, error }));
    }, []),
  };

  return [state, actions];
}
