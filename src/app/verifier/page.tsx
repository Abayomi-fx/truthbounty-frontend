'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { VerifierDashboardContainer } from '@/features/verifier-dashboard/VerifierDashboardContainer';
import { StakeEffectiveWeightReview } from '@/components/features/verification/StakeEffectiveWeightReview';

export default function VerifierPage() {
  return (
    <MainLayout>
      <VerifierDashboardContainer />
      <StakeEffectiveWeightReview />
    </MainLayout>
  );
}