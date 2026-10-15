'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { AdminDashboard } from '@/components/features/admin-dashboard';

export default function AdminRoutePage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl">
        <AdminDashboard />
      </div>
    </MainLayout>
  );
}
