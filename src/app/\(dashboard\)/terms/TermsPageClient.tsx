'use client';

import React from 'react';
import { TermsRenderer } from '@/components/features/terms/TermsRenderer';
import type { TermsVersion, NetworkType } from '@/app/types/terms';

interface TermsPageClientProps {
  network: NetworkType;
  currentVersion: TermsVersion;
  allVersions: TermsVersion[];
}

export function TermsPageClient({ network, currentVersion, allVersions }: TermsPageClientProps) {
  const [selectedVersion, setSelectedVersion] = React.useState(currentVersion.version);

  const versionToRender = allVersions.find((v) => v.version === selectedVersion) || currentVersion;

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('version', version);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Skip link target */}
      <div id="main" tabIndex={-1} role="main" className="pt-8 pb-16">
        <TermsRenderer
          version={versionToRender}
          allVersions={allVersions}
          network={network}
          onVersionChange={handleVersionChange}
        />
      </div>
    </div>
  );
}