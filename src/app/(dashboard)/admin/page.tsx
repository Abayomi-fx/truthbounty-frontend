'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { HelpTroubleshooting } from '@/components/features/support/HelpTroubleshooting';
import ServiceStatusOverview from '@/components/features/service-status/ServiceStatusOverview';
import { GovernanceProposalsSection } from '@/components/features/governance-proposals/GovernanceProposalsSection';

export default function AdminPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-8">
        <HelpTroubleshooting />
        <h1 className="text-2xl font-semibold">Admin</h1>
        <ServiceStatusOverview />
        <GovernanceProposalsSection />
      </div>
    </MainLayout>
  );
}