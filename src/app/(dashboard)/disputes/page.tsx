'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { MdGavel, MdInfoOutline } from 'react-icons/md';
import Link from 'next/link';
import { APP_ROUTES } from '@/config/navigation';

export default function DisputesRoutePage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Active Disputes & Appeals
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor and participate in protocol dispute resolution, challenge periods, and multi-round appeals.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <MdGavel className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Dispute Resolution Window</h2>
              <p className="text-sm text-muted-foreground">
                Claims entering the dispute phase allow bonded challengers and consensus verifiers to submit counter-evidence. Bonded challenges are verified against canonical Optimism contracts.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MdInfoOutline className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No Active Disputes</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            All current claims are either in open verification or have reached canonical settlement without challenges.
          </p>
          <div className="mt-5">
            <Link
              href={APP_ROUTES.HOME}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Explore Claims
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
