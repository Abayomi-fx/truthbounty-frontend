import { WorldcoinVerifyButton } from './WorldcoinVerifyButton';
import { VerificationStatusIndicator } from './VerificationStatusIndicator';
import { VerificationSuccessCard } from './VerificationSuccessCard';
import { VerificationErrorCard } from './VerificationErrorCard';
import { WorldcoinInfoTooltip } from './WorldcoinInfoTooltip';
import { useWorldcoinVerification } from '@/hooks/useWorldcoinVerification';

interface WorldcoinVerificationPanelProps {
  walletAddress?: string;
  onVerificationChange?: (verified: boolean) => void;
  compact?: boolean;
}

export function WorldcoinVerificationPanel({
  walletAddress,
  onVerificationChange,
  compact = false,
}: WorldcoinVerificationPanelProps) {
  const {
    status,
    verification,
    handleIDKitProof,
    isMockMode,
    refresh,
  } = useWorldcoinVerification({
    walletAddress,
    autoCheck: true,
  });

  const verificationLevel = verification?.result?.verification_level || 'orb';
  const verifiedAt = verification?.verifiedAt;
  const expiresAt = verification?.expiresAt;
  const error = verification?.error;

  // Show success/error based on status
  const showSuccess = status === 'SUCCESS' && verifiedAt;
  const showError = status === 'FAILED' && error;

  const handleVerificationStart = () => {
    // Status changes automatically through hook
  };

  const handleVerificationComplete = (success: boolean) => {
    onVerificationChange?.(success);
    if (success) {
      // Refresh verification status from backend
      refresh();
    }
  };

  const handleRetry = () => {
    refresh();
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {status === 'SUCCESS' ? (
          <VerificationStatusIndicator
            status={status}
            verificationLevel={verificationLevel}
            expiresAt={expiresAt}
          />
        ) : (
          <>
            <WorldcoinVerifyButton
              walletAddress={walletAddress}
              onVerificationStart={handleVerificationStart}
              onVerificationComplete={handleVerificationComplete}
              onIDKitProof={handleIDKitProof}
              disabled={!walletAddress}
              useMockMode={isMockMode}
            />
            <WorldcoinInfoTooltip />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Identity Verification
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {isMockMode
              ? '(Mock Mode) Click the button to simulate identity verification'
              : 'Verify your identity with Worldcoin to unlock full platform access'}
          </p>
        </div>
        <div className="shrink-0">
          <WorldcoinInfoTooltip />
        </div>
      </div>

      {showSuccess && verifiedAt && (
        <VerificationSuccessCard
          verificationLevel={verificationLevel}
          verifiedAt={verifiedAt}
          expiresAt={expiresAt}
          onClose={() => {
            // Status can be viewed again, just refresh
            refresh();
          }}
        />
      )}

      {showError && error && (
        <VerificationErrorCard
          error={error}
          onRetry={handleRetry}
          onDismiss={() => {
            handleRetry();
          }}
        />
      )}

      {!showSuccess && !showError && (
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <VerificationStatusIndicator
                  status={status}
                  verificationLevel={verificationLevel}
                  expiresAt={expiresAt}
                  showLabel={true}
                />
              </div>
              
              {status === 'NOT_STARTED' && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {walletAddress 
                    ? 'Click the button to start verification'
                    : 'Connect your wallet to begin verification'}
                </p>
              )}
              
              {status === 'IN_PROGRESS' && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Verification in progress...
                </p>
              )}
              
              {status === 'SUCCESS' && verifiedAt && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Verified on {new Date(verifiedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {status !== 'SUCCESS' && (
              <WorldcoinVerifyButton
                walletAddress={walletAddress}
                onVerificationStart={handleVerificationStart}
                onVerificationComplete={handleVerificationComplete}
                onIDKitProof={handleIDKitProof}
                disabled={!walletAddress}
                useMockMode={isMockMode}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
