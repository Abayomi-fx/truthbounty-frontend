'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TermsRenderer } from '@/components/features/terms/TermsRenderer';
import type { TermsVersion, NetworkType } from '@/app/types/terms';

interface TermsPageClientProps {
  network: NetworkType;
  currentVersion: TermsVersion;
  allVersions: TermsVersion[];
}

export function TermsPageClient({ network, currentVersion, allVersions }: TermsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize selectedVersion from URL param or fallback to currentVersion
  const urlVersion = searchParams.get('version');
  const initialVersion = urlVersion && allVersions.some((v) => v.version === urlVersion) 
    ? urlVersion 
    : currentVersion.version;

  const [selectedVersion, setSelectedVersion] = React.useState(initialVersion);

  // Sync selectedVersion with URL param changes
  React.useEffect(() => {
    const urlVersion = searchParams.get('version');
    if (urlVersion && urlVersion !== selectedVersion && allVersions.some((v) => v.version === urlVersion)) {
      setSelectedVersion(urlVersion);
    }
  }, [searchParams, selectedVersion, allVersions]);

  const versionToRender = allVersions.find((v) => v.version === selectedVersion) || currentVersion;

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    const params = new URLSearchParams(searchParams.toString());
    params.set('version', version);
    router.replace(`/terms?${params.toString()}`);
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