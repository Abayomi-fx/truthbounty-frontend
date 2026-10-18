import { Metadata } from 'next';
import { getTermsMetadata, getTerms } from '@/data/terms';
import { TermsPageClient } from './TermsPageClient';

interface TermsPageProps {
  params: Promise<{ network?: string; version?: string }>;
  searchParams: Promise<{ network?: string; version?: string }>;
}

export async function generateMetadata({ params, searchParams }: TermsPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const network = (resolvedParams.network ?? resolvedSearchParams.network ?? 'testnet') as 'testnet' | 'mainnet';
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

export async function generateStaticParams() {
  return [
    { network: 'testnet' },
    { network: 'mainnet' },
  ];
}

export default async function TermsPage({ params, searchParams }: TermsPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const network = (resolvedParams.network ?? resolvedSearchParams.network ?? 'testnet') as 'testnet' | 'mainnet';
  const version = resolvedParams.version ?? resolvedSearchParams.version;
  
  const metadata = getTermsMetadata(network);
  const currentVersion = getTerms(network, version);
  const allVersions = getTermsMetadata(network).versions;

  return <TermsPageClient 
    network={network} 
    currentVersion={currentVersion} 
    allVersions={allVersions} 
  />;
}