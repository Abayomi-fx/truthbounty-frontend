'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { APP_ROUTES } from '@/config/navigation';

export default function RewardsRoutePage() {
  useEffect(() => {
    // The fragment is browser-only; preserve both it and query state.
    window.location.replace(APP_ROUTES.REWARDS + window.location.search + window.location.hash);
  }, []);
  return <p>Rewards have moved. <Link href={APP_ROUTES.REWARDS}>Open rewards</Link></p>;
}
