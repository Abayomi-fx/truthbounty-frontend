'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { HelpTroubleshooting } from '@/components/features/support/HelpTroubleshooting';

export default function AdminPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl">
        <HelpTroubleshooting />
      </div>
    </MainLayout>
  );
}
