'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { HelpTroubleshooting } from '@/components/features/support/HelpTroubleshooting';
import ServiceStatusOverview from '@/components/features/service-status/ServiceStatusOverview';

export default function AdminPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl">
        <HelpTroubleshooting />
        <h1 className="text-2xl font-semibold">Admin</h1>
        <ServiceStatusOverview />
      </div>
    </MainLayout>
  );
}