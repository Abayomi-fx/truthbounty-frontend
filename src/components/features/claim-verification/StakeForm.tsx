'use client';

import { useState, useEffect } from 'react';
import { getTokenBalance } from '@/app/lib/wallet';
import { useAccount } from '@/hooks/useAccount';

import { FormattedToken } from '@/components/ui/formatting';

export function StakeForm({
  claimId: _claimId,
  onStakeChange,
}: {
  claimId: string;
  onStakeChange?: (stake: string) => void;
}) {
  void _claimId;
  const [stake, setStake] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const account = useAccount();

  useEffect(() => {
    if (!account?.address) {
      setBalance(null);
      return;
    }

    const fetchBalance = () =>
      getTokenBalance(account.address)
        .then((value) => setBalance(Number(value)))
        .catch(() => {
          setBalance(null);
        });

    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [account?.address]);

  const handleStakeChange = (value: string) => {
    setStake(value);
    onStakeChange?.(value);
  };

  return (
    <div className="card p-4 sm:p-6">
      <h3 className="font-semibold mb-3 text-base sm:text-lg">Stake Tokens</h3>

      <label htmlFor="stake-amount" className="sr-only">Stake amount</label>
      <input
        id="stake-amount"
        type="number"
        value={stake}
        onChange={(e) => handleStakeChange(e.target.value)}
        placeholder="Enter stake amount"
        aria-label="Stake amount"
        className="input w-full p-3 sm:p-3 text-base min-h-[44px] touch-manipulation"
      />

      {balance !== null && (
        <p className="text-sm sm:text-sm mt-2 flex items-center gap-1.5">
          <span>Balance: </span>
          <FormattedToken amount={balance} symbol="TBNT" />
        </p>
      )}

      {balance !== null && Number(stake) > balance && (
        <p className="text-red-500 text-sm mt-2" role="alert">
          Insufficient balance
        </p>
      )}
    </div>
  );
}

export default StakeForm;
