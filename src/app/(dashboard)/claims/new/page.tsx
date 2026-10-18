'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import ClaimSubmissionForm from '@/components/features/claim-submission/ClaimSubmissionForm';

export default function NewClaimPage() {
  const router = useRouter();

  return (
    <MainLayout>
      <div className="min-h-full bg-background px-4 py-8 sm:px-6 lg:px-8">
        <ClaimSubmissionForm onClose={() => router.push('/')} />
      </div>
    </MainLayout>
  );
}
