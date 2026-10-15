'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { VerifierDashboardContainer } from '@/features/verifier-dashboard/VerifierDashboardContainer';

export default function VerifierPage() {
  return (
    <MainLayout>
      <VerifierDashboardContainer />
    </MainLayout>
  );
}