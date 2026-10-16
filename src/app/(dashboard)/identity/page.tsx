'use client';

import { useState } from 'react';
import { WorldcoinVerificationPanel } from '@/components/features/worldcoin';
import { SiweSessionPanel } from '@/components/auth';
import { useAccount } from '@/hooks/useAccount';
import { Info } from 'lucide-react';

export default function IdentityPage() {
  const account = useAccount();
  const [isVerified, setIsVerified] = useState(false);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Identity Verification
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Verify your identity to unlock full access to TruthBounty and protect against Sybil attacks
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Why verify with Worldcoin?</p>
              <p className="text-blue-700 dark:text-blue-300">
                Worldcoin uses zero-knowledge proofs to verify you&apos;re a unique human without revealing your identity. 
                This prevents fake accounts and manipulation while preserving your privacy.
              </p>
            </div>
          </div>
        </div>

        {/* Secure wallet sign-in (EIP-4361) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Step 1: Sign in with Ethereum
          </h2>
          <SiweSessionPanel />
        </div>

        {/* Worldcoin Verification */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Step 2: Verify Identity
          </h2>

          <WorldcoinVerificationPanel
            walletAddress={account?.address}
            onVerificationChange={setIsVerified}
          />
        </div>

        {/* Benefits */}
        {isVerified && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🎉 You&apos;re All Set!
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your identity is now verified. You can now:
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                Submit and verify claims with higher stake limits
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                Earn higher reputation scores and rewards
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                Access priority verification and dispute resolution
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                Participate in governance decisions
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
    </MainLayout>
  );
}