/**
 * Troubleshooting topic fixtures for the /support Help & Troubleshooting
 * composition.
 *
 * These fixtures are data-only. They preserve the transaction /
 * projection distinction required by the acceptance criteria, and they do
 * not assume any unapproved endpoints, channels, SLAs, rewards, or legal
 * copy. Escalation channels are explicitly marked as unavailable when no
 * approved channel is configured.
 */

export type TroubleshootingCategoryId =
  | 'wallet-network'
  | 'transactions'
  | 'indexing'
  | 'evidence'
  | 'claims'
  | 'verification'
  | 'dispute'
  | 'rewards';

export type TroubleshootingStateTone = 'neutral' | 'info' | 'warning' | 'danger';

export interface TroubleshootingStep {
  /** Stable identifier for the step. */
  id: string;
  /** Short label for the step. */
  label: string;
  /** Explanation of what the step does and why. */
  description: string;
  /**
   * Whether this step can auto-sign, auto-submit, or auto-switch
   * networks. Always false in this composition; the field exists so the
   * constraint is testable and auditable.
   */
  autoSignsOrSubmits: false;
  /** Optional external reference (non-actionable). */
  reference?: string;
}

export interface TroubleshootingState {
  /** Stable identifier for the state. */
  id: string;
  /** Human-readable name of the state. */
  name: string;
  /** Whether this describes a transaction or a projection/indexed view. */
  kind: 'transaction' | 'projection';
  /** Visual tone for the state badge. */
  tone: TroubleshootingStateTone;
  /** What the user observes when in this state. */
  observed: string;
  /** What this state means (without guarantees). */
  meaning: string;
  /** Ordered recovery steps for this state. */
  steps: TroubleshootingStep[];
}

export interface TroubleshootingCategory {
  id: TroubleshootingCategoryId;
  title: string;
  summary: string;
  states: TroubleshootingState[];
}

export interface EscalationChannel {
  id: string;
  label: string;
  /**
   * Whether this channel is approved for use. When false, the UI must
   * render an explicit unavailable message and must not link out.
   */
  available: boolean;
  /** Optional description of the channel purpose. */
  description?: string;
  /** Optional href. Only rendered when available is true. */
  href?: string;
}

export interface TroubleshootingMetadata {
  /** Content version of the guidance. */
  version: string;
  /** Release identifier the guidance was published with. */
  release: string;
  /** Source of the guidance (authority document). */
  source: string;
  /** ISO timestamp of when this guidance was last reviewed. */
  freshnessTimestamp: string;
}

export interface TroubleshootingContent {
  metadata: TroubleshootingMetadata;
  categories: TroubleshootingCategory[];
  escalationChannels: EscalationChannel[];
}

/**
 * Static troubleshootingContent fixture.
 *
 * Note: All escalation channels are marked as unavailable because no
 * approved channel has been authorized for this composition yet. This is
 * deliberate and is a requirement of the issue: unavailable escalation
 * must be explicit.
 */
export const troubleshootingContent: TroubleshootingContent = {
  metadata: {
    version: '1.0.0',
    release: 'ui-fe-035',
    source:
      'https://github.com/DigiNodes/truthbounty-protocol/blob/main/designs/frontend-v2/support-legal/boards/03-help-troubleshooting.svg',
    freshnessTimestamp: '2025-01-01T00:00:00.000Z',
  },
  categories: [
    {
      id: 'wallet-network',
      title: 'Wallet and network',
      summary:
        'Recovery guidance for wallet connection and network selection issues.',
      states: [
        {
          id: 'wallet-disconnected',
          name: 'Wallet disconnected',
          kind: 'projection',
          tone: 'neutral',
          observed: 'The app shows no connected account.',
          meaning:
            'No wallet account is currently available to the app. This is a local view state, not a chain outcome.',
          steps: [
            {
              id: 'wallet-connect-manually',
              label: 'Connect your wallet manually',
              description:
                'Use the Connect Wallet button in the app to authorize an account. The app will never connect on your behalf without your explicit action.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'wallet-check-extension',
              label: 'Check your wallet extension',
              description:
                'Ensure your browser wallet extension is installed and unlocked. Reload the page after installing if needed.',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'wallet-wrong-network',
          name: 'Wrong network',
          kind: 'projection',
          tone: 'warning',
          observed:
            'The app reports that the connected chain does not match the expected chain.',
          meaning:
            'The wallet is connected to a different chain than the one this app expects. No transaction has been submitted.',
          steps: [
            {
              id: 'wallet-switch-manually',
              label: 'Switch network in your wallet',
              description:
                'Open your wallet extension and select the correct network. The app will not switch networks for you.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'wallet-reconnect',
              label: 'Reconnect after switching',
              description:
                'After switching networks, reconnect the wallet if the app does not update automatically.',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'transactions',
      title: 'Transactions',
      summary:
        'Recovery guidance for rejected, replaced, and reverted transactions.',
      states: [
        {
          id: 'tx-rejected',
          name: 'Transaction rejected',
          kind: 'transaction',
          tone: 'warning',
          observed:
            'The wallet reported that the signature request was rejected by the user.',
          meaning:
            'The transaction was never broadcast. No chain state change occurred.',
          steps: [
            {
              id: 'tx-rejected-review',
              label: 'Review the transaction details',
              description:
                'Check the details in the app before retrying. The app will not resubmit on its own.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'tx-rejected-retry',
              label: 'Retry when ready',
              description:
                'When you are ready, start a new transaction from the app. You will be asked to sign again.',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'tx-replaced',
          name: 'Transaction replaced',
          kind: 'transaction',
          tone: 'info',
          observed:
            'The app reports that the transaction was replaced by another transaction.',
          meaning:
            'A transaction with the same nonce was included instead. The original transaction will not confirm.',
          steps: [
            {
              id: 'tx-replaced-verify',
              label: 'Verify the replacement hash',
              description:
                'Compare the replacement transaction hash shown in the app with your wallet history.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'tx-replaced-wait',
              label: 'Wait for the replacement to settle',
              description:
                'Wait for the replacement transaction to confirm. The app will reflect the final outcome once indexed.',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'tx-reverted',
          name: 'Transaction reverted',
          kind: 'transaction',
          tone: 'danger',
          observed:
            'The app reports that the transaction was included but reverted on-chain.',
          meaning:
            'The transaction consumed gas but did not change protocol state. The app cannot reverse this outcome.',
          steps: [
            {
              id: 'tx-reverted-reason',
              label: 'Review the revert reason',
              description:
                'Check the revert reason and transaction details in the app to understand what failed.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'tx-reverted-adjust',
              label: 'Adjust inputs and retry',
              description:
                'Adjust the inputs that caused the revert and start a new transaction. You will be asked to sign again.',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'indexing',
      title: 'Indexing delay and reorgs',
      summary:
        'Recovery guidance for indexing delays and chain reorgs.',
      states: [
        {
          id: 'indexing-delay',
          name: 'Indexing delay',
          kind: 'projection',
          tone: 'info',
          observed:
            'The transaction is confirmed on-chain but the app has not yet shown the updated projection.',
          meaning:
            'The indexer has not yet reconciled the on-chain event. This is a projection delay, not a transaction failure.',
          steps: [
            {
              id: 'indexing-wait',
              label: 'Wait and refresh',
              description:
                'Wait a moment and refresh the view. The app will reflect the indexed state once available.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'indexing-tx-hash',
              label: 'Compare transaction and projection',
              description:
                'Compare the transaction hash with the projection data shown in the app to confirm they refer to the same event.',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'indexing-reorg',
          name: 'Chain reorg',
          kind: 'projection',
          tone: 'warning',
          observed:
            'The app reports that a previously indexed event was reorganized out of the canonical chain.',
          meaning:
            'The chain reorganized and the projection is being reconciled. The app cannot reverse chain outcomes.',
          steps: [
            {
              id: 'indexing-reorg-wait',
              label: 'Wait for reconciliation',
              description:
                'Wait for the indexer to reconcile the reorg. The app will update the projection once complete.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'indexing-reorg-report',
              label: 'Report a persistent mismatch',
              description:
                'If the projection remains inconsistent after reconciliation, use the escalation section below.',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'evidence',
      title: 'Evidence availability',
      summary: 'Recovery guidance for missing or unavailable evidence.',
      states: [
        {
          id: 'evidence-unavailable',
          name: 'Evidence unavailable',
          kind: 'projection',
          tone: 'warning',
          observed:
            'The app reports that an evidence item cannot be displayed.',
          meaning:
            'The evidence reference is present but the content is not available to the app. This does not change the claim outcome.',
          steps: [
            {
              id: 'evidence-refresh',
              label: 'Refresh the evidence view',
              description:
                'Refresh the page to request the evidence again. The app will not modify the evidence or the claim.',
              autoSignsOrSubmits: false,
            },
            {
              id: 'evidence-reference-check',
              label: 'Check the evidence reference',
              description:
                'Confirm the evidence reference shown in the app matches the one you expect. The app does not fetch external content on your behalf.',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'evidence-pending',
          name: 'Evidence pending indexing',
          kind: 'projection',
          tone: 'info',
          observed:
            'The app reports that an evidence item is pending indexing.',
          meaning:
            'The evidence reference has been recorded but the projection has not yet reconciled it. This is a projection delay.',
          steps: [
            {
              id: 'evidence-pending-wait',
              label: 'Wait for indexing',
              description:
                'Wait for the indexer to reconcile the evidence reference. The app will update the view once available.',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'claims',
      title: 'Claims',
      summary: 'Recovery guidance for claim states.',
      states: [
        {
          id: 'claim-pending',
          name: 'Claim pending',
          kind: 'projection',
          tone: 'info',
          observed: 'The app shows the claim as pending.',
          meaning:
            'The claim has been submitted but not yet resolved. The app cannot promise a resolution time.',
          steps: [
            {
              id: 'claim-pending-wait',
              label: 'Wait for resolution',
              description:
                'Wait for the claim to be resolved. The app will update the claim state once the projection reconciles.',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'claim-disputed',
          name: 'Claim disputed',
          kind: 'projection',
          tone: 'warning',
          observed:'The app shows the claim as disputed.',
          meaning:
            'The claim is under dispute. The app cannot reverse the dispute outcome.',
          steps: [
            {
              id: 'claim-disputed-review',
              label: 'Review the dispute details',
              description:
                'Review the dispute details in the app to understand the current state. The app does not adjudicate disputes.',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'verification',
      title: 'Verification',
      summary: 'Recovery guidance for verification states.',
      states: [
        {
          id: 'verification-pending',
          name: 'Verification pending',
          kind: 'projection',
          tone: 'info',
          observed: 'The app shows verification as pending.',
          meaning:
            'Verification has been requested but not yet completed. The app cannot promise a verification timeline',
          steps: [
            {
              id: 'verification-pending-wait',
              label: 'Wait for verification',
              description:
                'Wait for verification to complete. The app will update the verification state once the projection reconciles',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'verification-failed',
          name: 'Verification failed',
          kind: 'projection',
          tone: 'danger',
          observed:'The app shows verification as failed.',
          meaning:
            'Verification did not succeed. The app cannot reverse the verification outcome',
          steps: [
            {
              id: 'verification-failed-review',
              label: 'Review the verification details',
              description:
                'Review the verification details in the app to understand why it failed. The app does not override verification results',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'dispute',
      title: 'Dispute',
      summary: 'Recovery guidance for dispute states.',
      states: [
        {
          id: 'dispute-open',
          name: 'Dispute open',
          kind: 'projection',
          tone: 'warning',
          observed:'The app shows an open dispute.',
          meaning:
            'A Dispute has been opened. The app cannot reverse dispute outcomes',
          steps: [
            {
              id: 'dispute-open-review',
              label: 'Review the dispute details',
              description:
                'Review the dispute details in the app to understand the current state. The app does not adjudicate disputes',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'dispute-resolved',
          name: 'Dispute resolved',
          kind: 'projection',
          tone: 'neutral',
          observed:'The app shows the dispute as resolved.',
          meaning:
            'The dispute has been resolved. The app cannot reverse the resolution',
          steps: [
            {
              id: 'dispute-resolved-review',
              label: 'Review the resolution details',
              description:
                'Review the resolution details in the app to understand the outcome. The app does not override dispute resolutions',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
    {
      id: 'rewards',
      title: 'Rewards',
      summary: 'Recovery guidance for reward states.',
      states: [
        {
          id: 'rewards-pending',
          name: 'Rewards pending',
          kind: 'projection',
          tone: 'info',
          observed: 'The app shows rewards as pending.',
          meaning:
            'Rewards are pending reconciliation. The app cannot promise a reward amount or timeline',
          steps: [
            {
              id: 'rewards-pending-wait',
              label: 'Wait for rewards to reconcile',
              description:
                'Wait for the projection to reconcile rewards. The app will update the rewards view once available',
              autoSignsOrSubmits: false,
            },
          ],
        },
        {
          id: 'rewards-claimed',
          name: 'Rewards claimed',
          kind: 'projection',
          tone: 'neutral',
          observed: 'The app shows rewards as claimed.',
          meaning:
            'Rewards are marked as claimed in the projection. The app cannot reverse a claim',
          steps: [
            {
              id: 'rewards-claimed-review',
              label: 'Review the reward details',
              description:
                'Review the reward details in the app to confirm the claimed state. The app does not override reward claims',
              autoSignsOrSubmits: false,
            },
          ],
        },
      ],
    },
  ],
  escalationChannels: [
    {
      id: 'support-channel',
      label: 'Support channel',
      available: false,
      description:
        'No approved support channel is available for this composition yet.',
    },
  ],
};
