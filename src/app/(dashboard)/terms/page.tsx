import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTermsMetadata, getTerms } from '@/data/terms';
import { TermsPageClient } from './TermsPageClient';

interface TermsPageProps {
  params: Promise<{ network?: string; version?: string }>;
  searchParams: Promise<{ network?: string; version?: string }>;
}

function isValidNetwork(network: string): network is 'testnet' | 'mainnet' {
  return network === 'testnet' || network === 'mainnet';
}

export async function generateMetadata({ params, searchParams }: TermsPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const networkParam = resolvedParams.network ?? resolvedSearchParams.network ?? 'testnet';
  const network = isValidNetwork(networkParam) ? networkParam : 'testnet';
  
  const metadata = getTermsMetadata(network);
  const currentVersion = getTerms(network, metadata.currentVersion);

  const networkLabel = network === 'testnet' ? 'Testnet (Optimism Sepolia)' : 'Mainnet (Optimism)';
  
  return {
    title: `Terms of Use v${currentVersion.version} • ${networkLabel} • TruthBounty`,
    description: `TruthBounty ${networkLabel} Terms of Use version ${currentVersion.version}, effective ${currentVersion.effectiveDate}. Covers eligibility, wallet responsibility, claims & evidence, staking & rewards, acceptable use, dependencies, availability, liability, governing law, and revisions.`,
    openGraph: {
      title: `Terms of Use v${currentVersion.version} • ${networkLabel} • TruthBounty`,
      description: `TruthBounty ${networkLabel} Terms of Use version ${currentVersion.version}`,
      type: 'website',
    },
  };
}

export default async function TermsPage({ params, searchParams }: TermsPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const networkParam = resolvedParams.network ?? resolvedSearchParams.network ?? 'testnet';
  const network = isValidNetwork(networkParam) ? networkParam : 'testnet';
  
  const versionParam = resolvedParams.version ?? resolvedSearchParams.version;
  
  const metadata = getTermsMetadata(network);
  const allVersions = metadata.versions;
  
  // Validate requested version exists for this network
  let currentVersion: ReturnType<typeof getTerms>;
  if (versionParam && allVersions.some((v) => v.version === versionParam)) {
    currentVersion = getTerms(network, versionParam);
  } else {
    currentVersion = getTerms(network, metadata.currentVersion);
  }

  return <TermsPageClient 
    network={network} 
    currentVersion={currentVersion} 
    allVersions={allVersions} 
  />;
}