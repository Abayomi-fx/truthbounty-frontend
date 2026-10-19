/**
 * Legal Consent Adapter Boundary for UI-FE-044
 * Enforces strict separation between legal consent and wallet/protocol states.
 */

export type ConsentStatus = 
  | 'ACCEPTED' 
  | 'DECLINED' 
  | 'STALE' 
  | 'UNAVAILABLE' 
  | 'NEEDS_RENEWAL';

export interface LegalVersionMetadata {
  currentVersion: string;
  previousVersion?: string;
  effectiveDate: string;
  isMaterialChange: boolean;
  documentUrl: string;
}

export interface ConsentAdapter {
  getConsentStatus(userId?: string): Promise<ConsentStatus>;
  recordConsent(version: string): Promise<boolean>;
  declineConsent(): void; // Pure state change; explicitly does NOT mutate protocol/wallet session
}

/**
 * Default implementation of the ConsentAdapter.
 * Communicates with backend endpoints while maintaining strict boundary rules.
 */
export class ApiConsentAdapter implements ConsentAdapter {
  async getConsentStatus(userId?: string): Promise<ConsentStatus> {
    try {
      const response = await fetch(`/api/user/consent-status${userId ? `?userId=${userId}` : ''}`);
      if (!response.ok) return 'UNAVAILABLE';
      
      const data = await response.json();
      return data.status as ConsentStatus;
    } catch {
      return 'UNAVAILABLE';
    }
  }

  async recordConsent(version: string): Promise<boolean> {
    try {
      const response = await fetch('/api/user/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, timestamp: new Date().toISOString() }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to record explicit consent:', error);
      return false;
    }
  }

  declineConsent(): void {
    // Ensures declining does NOT mutate wallet states, keys, or active protocol sessions
    console.warn('Legal consent declined by user. Session restricted to public legal views only.');
  }
}

export const legalConsentAdapter = new ApiConsentAdapter();
