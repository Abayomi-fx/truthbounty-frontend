'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { AnalyticsConsentManager } from '@/components/analytics/AnalyticsConsentManager';
import { EconomicRiskDisclosure } from '@/components/features/economics/EconomicRiskDisclosure';
import { ServiceStatusOverview } from '@/components/features/service-status/ServiceStatusOverview';
import { TermsRenderer } from '@/components/features/terms/TermsRenderer';
import { TermsReviewState } from '@/components/features/terms/TermsReviewState';
import { TermsSection } from '@/components/features/terms/TermsSection';
import { TermsVersionSelector } from '@/components/features/terms/TermsVersionSelector';
import { Card, StatusBadge } from '@/components/ui/primitives';
import { RESOURCE_LINKS } from '@/config/navigation';
import { TESTNET_TERMS_VERSIONS } from '@/data/terms';
import type {
  ObservationFreshnessLevel,
  PublicServiceStatusObservation,
  ServiceComponentId,
  ServiceComponentObservation,
  ServiceStatusTone,
} from '@/app/queries/status.queries';
import type { TermsClause, TermsVersion } from '@/app/types/terms';
import { REDACTION_RULES } from '@/lib/telemetry';
import { makeIncidentEvent } from '@/testing/fixtures/factories/incidents';
import { makeLegalContentVersion } from '@/testing/fixtures/factories/legal-content';

export const PINNED_RELEASE = {
  chainId: 11155420,
  releaseId: 'v2.0.0-sepolia',
  protocolVersion: '2.0.0',
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
} as const;

const NOW_ISO = '2026-10-14T00:10:00.000Z';
const NOW = Date.parse(NOW_ISO);
const FRESH_AT = '2026-10-14T00:00:00.000Z';
const STALE_AT = '2026-10-10T00:00:00.000Z';

export type SupportStatusLegalScenario =
  | 'support-valid'
  | 'support-validation'
  | 'support-secret'
  | 'support-duplicate'
  | 'status-operational'
  | 'status-degraded'
  | 'status-stale'
  | 'status-unavailable'
  | 'status-maintenance'
  | 'incident-fresh'
  | 'incident-stale'
  | 'legal-current'
  | 'legal-stale'
  | 'legal-review'
  | 'legal-retired'
  | 'consent'
  | 'disclosures';

const SUPPORT_CATEGORIES = [
  'Claim issue',
  'Evidence issue',
  'Wallet issue',
  'Other',
] as const;

function containsSecret(value: string): boolean {
  return REDACTION_RULES.filter(
    (rule) =>
      rule.label !== '[REDACTED_ADDRESS]' &&
      rule.label !== '[REDACTED_EMAIL]',
  ).some((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(value);
  });
}

function SupportSection({
  scenario,
}: {
  scenario: SupportStatusLegalScenario;
}) {
  const prefilled = scenario === 'support-valid' || scenario === 'support-duplicate';
  const [email, setEmail] = useState(prefilled ? 'claimant@example.test' : '');
  const [category, setCategory] = useState(prefilled ? 'Claim issue' : '');
  const [message, setMessage] = useState(
    prefilled ? 'Please review the indexed projection for my claim.' : '',
  );
  const [errors, setErrors] = useState<{
    email?: string;
    category?: string;
    message?: string;
  }>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [secretBlocked, setSecretBlocked] = useState(false);
  const [submissions, setSubmissions] = useState<string[]>(() =>
    scenario === 'support-duplicate'
      ? ['claimant@example.test|Claim issue|Please review the indexed projection for my claim.']
      : [],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!category) nextErrors.category = 'Select a request category.';
    if (message.trim().length < 10) {
      nextErrors.message = 'Provide at least 10 characters.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSuccess(null);
      return;
    }
    if (containsSecret(message)) {
      setSecretBlocked(true);
      setMessage('');
      setErrors({
        message:
          'Potential secret material detected. The message was cleared and not submitted.',
      });
      setSuccess(null);
      return;
    }
    const key = `${email}|${category}|${message.trim()}`;
    if (submissions.includes(key)) {
      setErrors({
        message: 'A request with these details was already submitted.',
      });
      setSuccess(null);
      return;
    }
    setSubmissions((current) => [...current, key]);
    setErrors({});
    setSecretBlocked(false);
    setSuccess('Support request recorded. Reference: SUP-2026-1014.');
  };

  return (
    <section aria-labelledby="support-heading" className="space-y-4">
      <h2 id="support-heading" className="text-lg font-semibold">
        Support request and responsible disclosure
      </h2>

      <Card className="p-4 sm:p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor="support-email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="support-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              autoComplete="email"
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="support-category"
              className="block text-sm font-medium"
            >
              Category
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Select a category</option>
              {SUPPORT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.category && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.category}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="support-message"
              className="block text-sm font-medium"
            >
              Message
            </label>
            <textarea
              id="support-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Describe the issue. Never include private keys, seed phrases, or credentials."
            />
            {errors.message && (
              <p
                role={secretBlocked ? 'alert' : 'alert'}
                className="mt-1 text-xs text-destructive"
              >
                {errors.message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Submit support request
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold"
              onClick={() => {
                setEmail('');
                setCategory('');
                setMessage('');
                setErrors({});
                setSuccess(null);
                setSecretBlocked(false);
              }}
            >
              Reset
            </button>
          </div>

          {success && (
            <p role="status" className="text-sm text-emerald-500">
              {success}
            </p>
          )}
        </form>
      </Card>

      <Card className="p-4 sm:p-6" data-testid="support-expectations">
        <h3 className="text-base font-semibold">Support expectations</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No SLA and no bounty are promised. This channel does not guarantee a
          response time or payment. Never send private keys, seed phrases,
          credentials, or session tokens.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a
              href={`${RESOURCE_LINKS.github}/security/policy`}
              className="underline underline-offset-2"
            >
              Responsible disclosure
            </a>
          </li>
          <li>
            <a href={RESOURCE_LINKS.bugReport} className="underline underline-offset-2">
              Report a bug
            </a>
          </li>
          <li>
            <a href={RESOURCE_LINKS.docs} className="underline underline-offset-2">
              Protocol documentation
            </a>
          </li>
        </ul>
      </Card>
    </section>
  );
}

function serviceComponent(
  id: ServiceComponentId,
  name: string,
  tone: ServiceStatusTone,
  message: string,
  overrides: Partial<ServiceComponentObservation> = {},
): ServiceComponentObservation {
  return {
    id,
    name,
    description: `${name} public observation.`,
    dependencyKind:
      id === 'rpc' || id === 'evidence-gateway' ? 'third-party' : 'first-party',
    tone,
    message,
    freshnessLevel: 'fresh',
    lastObservedAt: FRESH_AT,
    lagDescription: null,
    ...overrides,
  };
}

function observation(
  overallTone: ServiceStatusTone,
  overallMessage: string,
  components: ServiceComponentObservation[],
  overrides: Partial<PublicServiceStatusObservation> = {},
): PublicServiceStatusObservation {
  return {
    overallTone,
    overallMessage,
    isPartial: false,
    components,
    lastObservedAt: FRESH_AT,
    finalizedBlock: 14282901,
    lagBlocks: 0,
    freshnessLevel: 'fresh',
    ...overrides,
  };
}

const OPERATIONAL_COMPONENTS = [
  serviceComponent('web', 'Web application', 'operational', 'Responding normally.'),
  serviceComponent('api', 'API', 'operational', 'Public reads are available.'),
  serviceComponent(
    'rpc',
    'RPC',
    'operational',
    'Primary endpoint responding; fallback configured.',
  ),
  serviceComponent('indexer', 'Indexer', 'operational', 'Ingestion is current.'),
  serviceComponent('database', 'Database', 'operational', 'Read replica healthy.'),
  serviceComponent(
    'evidence-gateway',
    'Evidence gateway',
    'operational',
    'Gateway reachable; content-addressed reads available.',
  ),
  serviceComponent('manifest', 'Release manifest', 'operational', 'Pinned manifest verified.'),
];

const STATUS_OBSERVATIONS: Record<string, PublicServiceStatusObservation> = {
  'status-operational': observation(
    'operational',
    'All reported components are operating normally.',
    OPERATIONAL_COMPONENTS,
  ),
  'status-degraded': observation(
    'degraded',
    'Some public components are degraded; freshness is reported below.',
    OPERATIONAL_COMPONENTS.map((component) =>
      component.id === 'api'
        ? { ...component, tone: 'degraded', message: 'Public API latency is elevated.' }
        : component.id === 'rpc'
          ? { ...component, tone: 'degraded', message: 'Primary RPC is degraded; fallback active.' }
          : component,
    ),
  ),
  'status-stale': observation(
    'stale',
    'The latest public observation is stale. Do not treat it as current.',
    OPERATIONAL_COMPONENTS.map((component) => ({
      ...component,
      tone: 'stale',
      freshnessLevel: 'stale' as ObservationFreshnessLevel,
      lastObservedAt: STALE_AT,
    })),
    {
      lastObservedAt: STALE_AT,
      freshnessLevel: 'stale',
      lagBlocks: 240,
    },
  ),
  'status-unavailable': observation(
    'unavailable',
    'No current public observation is available.',
    OPERATIONAL_COMPONENTS.map((component) => ({
      ...component,
      tone: 'unavailable',
      freshnessLevel: 'unknown' as ObservationFreshnessLevel,
      lastObservedAt: null,
      message: 'No public observation recorded.',
    })),
    {
      lastObservedAt: null,
      finalizedBlock: null,
      lagBlocks: null,
      freshnessLevel: 'unknown',
    },
  ),
  'status-maintenance': observation(
    'degraded',
    'Scheduled maintenance is in progress. Public reads may be delayed.',
    OPERATIONAL_COMPONENTS.map((component) =>
      component.id === 'api' || component.id === 'indexer'
        ? {
            ...component,
            tone: 'delayed',
            message: 'Scheduled maintenance is in progress for this component.',
          }
        : component,
    ),
  ),
};

const INCIDENTS = [
  makeIncidentEvent({
    key: 'rpc-degraded',
    severity: 'warning',
    message: 'RPC provider degraded; fallback active.',
    overrides: { timestamp: FRESH_AT },
  }),
  makeIncidentEvent({
    key: 'indexer-lag',
    severity: 'error',
    message: 'Indexer freshness threshold exceeded.',
    overrides: { timestamp: STALE_AT },
  }),
];

function incidentIsStale(timestamp: string): boolean {
  return NOW - Date.parse(timestamp) > 60 * 60 * 1000;
}

function IncidentSection({ staleOnly }: { staleOnly: boolean }) {
  const incidents = INCIDENTS.filter((incident) =>
    staleOnly ? incidentIsStale(incident.timestamp) : !incidentIsStale(incident.timestamp),
  );

  return (
    <section aria-labelledby="incidents-heading" className="space-y-3">
      <h2 id="incidents-heading" className="text-lg font-semibold">
        Public incidents
      </h2>
      <ul className="space-y-3">
        {incidents.map((incident) => {
          const stale = incidentIsStale(incident.timestamp);
          return (
            <li
              key={incident.id}
              data-testid={`incident-${incident.context?.scenarioKey ?? 'unknown'}`}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge
                  label={incident.severity}
                  tone={incident.severity === 'error' ? 'danger' : 'warning'}
                />
                <StatusBadge
                  label={stale ? 'Stale observation' : 'Fresh observation'}
                  tone={stale ? 'warning' : 'success'}
                />
              </div>
              <p className="mt-2 text-sm">{incident.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Observed {incident.timestamp}. {stale ? 'Not current.' : 'Within the public freshness window.'}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusSection({
  scenario,
}: {
  scenario: SupportStatusLegalScenario;
}) {
  const observation = STATUS_OBSERVATIONS[scenario] ?? STATUS_OBSERVATIONS['status-operational'];
  const showStale = scenario === 'incident-stale';

  return (
    <section aria-labelledby="status-heading" className="space-y-4">
      <h2 id="status-heading" className="text-lg font-semibold">
        Public status and system support
      </h2>
      <ServiceStatusOverview observation={observation} />
      <IncidentSection staleOnly={showStale} />
      <Card className="p-4 sm:p-6">
        <h3 className="text-base font-semibold">System support</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Status reports sanitized public observations only. No uptime,
          infrastructure control, restart, pause, or scaling action is exposed.
          No SLA is promised.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a href={RESOURCE_LINKS.bugReport} className="underline underline-offset-2">
              Report a bug
            </a>
          </li>
          <li>
            <a
              href={`${RESOURCE_LINKS.github}/security/policy`}
              className="underline underline-offset-2"
            >
              Responsible disclosure
            </a>
          </li>
        </ul>
      </Card>
    </section>
  );
}

const CURRENT_TERMS = TESTNET_TERMS_VERSIONS[0];
const REVIEW_CLAUSE = CURRENT_TERMS.clauses.find(
  (clause) => clause.id === 'staking-rewards-disputes',
) as TermsClause;

const OLD_TERMS: TermsVersion = {
  ...CURRENT_TERMS,
  version: '0.9.0',
  effectiveDate: '2025-01-01',
  materialChanges: 'Initial pre-release legal version.',
  publishedAt: '2025-01-01T00:00:00.000Z',
};

const DRAFT_TERMS: TermsVersion = {
  ...CURRENT_TERMS,
  version: '1.1.0-draft',
  status: 'draft',
  effectiveDate: '2026-12-01',
  publishedAt: undefined,
  materialChanges: 'Draft legal update pending review.',
};

function LegalSection({
  scenario,
}: {
  scenario: SupportStatusLegalScenario;
}) {
  return (
    <section aria-labelledby="legal-heading" className="space-y-4">
      <h2 id="legal-heading" className="text-lg font-semibold">
        Legal versions, disclosures, and review states
      </h2>

      {scenario === 'legal-current' && (
        <TermsRenderer
          version={CURRENT_TERMS}
          allVersions={[CURRENT_TERMS]}
          network="testnet"
          onVersionChange={() => undefined}
        />
      )}

      {scenario === 'legal-stale' && (
        <>
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Legal version status</h3>
              <StatusBadge label="Superseded" tone="warning" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Version 0.9.0 effective 2025-01-01 is superseded by the current
              version 1.0.0 effective 2026-01-15.
            </p>
          </Card>
          <TermsVersionSelector
            versions={[CURRENT_TERMS, OLD_TERMS]}
            currentVersion="1.0.0"
            network="testnet"
            onVersionChange={() => undefined}
          />
        </>
      )}

      {scenario === 'legal-review' && (
        <>
          <TermsSection
            clause={REVIEW_CLAUSE}
            sectionId="staking-rewards-disputes"
            network="testnet"
          />
          <TermsReviewState
            status={REVIEW_CLAUSE.status}
            reviewerNotes={REVIEW_CLAUSE.reviewerNotes}
            clauseTitle={REVIEW_CLAUSE.title}
            network="testnet"
          />
          <TermsVersionSelector
            versions={[CURRENT_TERMS, DRAFT_TERMS]}
            currentVersion="1.0.0"
            network="testnet"
            onVersionChange={() => undefined}
          />
        </>
      )}

      {scenario === 'legal-retired' && (
        <>
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Retired release</h3>
              <StatusBadge label="Retired" tone="neutral" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Release v1.9.0 is retired. The pinned release is v2.0.0-sepolia on
              chain 11155420. Retired legal versions are not presented as current.
            </p>
          </Card>
          <TermsVersionSelector
            versions={[CURRENT_TERMS, OLD_TERMS]}
            currentVersion="1.0.0"
            network="testnet"
            onVersionChange={() => undefined}
          />
        </>
      )}

      <Card className="p-4 sm:p-6" data-testid="legal-expectations">
        <h3 className="text-base font-semibold">Legal expectations</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No SLA and no bounty are promised. Effective dates and version sources
          are explicit. Draft or review copy is never presented as approved
          production policy.
        </p>
      </Card>
    </section>
  );
}

const CONSENT_VERSION = makeLegalContentVersion({
  id: 'analytics-consent',
  version: 'v2',
  overrides: {
    effectiveAt: '2026-10-01T00:00:00.000Z',
    summary: 'Analytics consent notice v2 effective 2026-10-01.',
  },
});

function ConsentSection() {
  return (
    <section aria-labelledby="consent-heading" className="space-y-4">
      <h2 id="consent-heading" className="text-lg font-semibold">
        Consent versioning and renewal
      </h2>
      <Card className="p-4 sm:p-6">
        <h3 className="text-base font-semibold">Consent notice version</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Version {CONSENT_VERSION.version} · effective {CONSENT_VERSION.effectiveAt}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Renewal is required when the consent notice version changes. Declining
          keeps optional analytics off.
        </p>
      </Card>
      <AnalyticsConsentManager>
        <main className="rounded-xl border border-border p-4">
          <h3 className="text-base font-semibold">Consent journey content</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional analytics remains off unless explicitly granted.
          </p>
        </main>
      </AnalyticsConsentManager>
    </section>
  );
}

function DisclosureSection() {
  return (
    <section aria-labelledby="disclosures-heading" className="space-y-4">
      <h2 id="disclosures-heading" className="text-lg font-semibold">
        Disclosures, support, and responsible disclosure
      </h2>
      <EconomicRiskDisclosure
        action="Dispute"
        bondWei={1000000000000000000n}
        allowanceWei={0n}
        balanceWei={5000000000000000000n}
      />
      <Card className="p-4 sm:p-6" data-testid="disclosure-expectations">
        <h3 className="text-base font-semibold">Expectations and contact</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No SLA and no bounty are promised. Reports are sanitized and handled
          through the official channels below. Never include private keys, seed
          phrases, credentials, or session tokens.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a
              href={`${RESOURCE_LINKS.github}/security/policy`}
              className="underline underline-offset-2"
            >
              Responsible disclosure
            </a>
          </li>
          <li>
            <a href={RESOURCE_LINKS.bugReport} className="underline underline-offset-2">
              Report a bug
            </a>
          </li>
          <li>
            <a href={RESOURCE_LINKS.docs} className="underline underline-offset-2">
              Protocol documentation
            </a>
          </li>
        </ul>
      </Card>
    </section>
  );
}

function isSupportScenario(scenario: SupportStatusLegalScenario) {
  return scenario.startsWith('support-');
}

function isStatusScenario(scenario: SupportStatusLegalScenario) {
  return (
    scenario.startsWith('status-') || scenario.startsWith('incident-')
  );
}

function isLegalScenario(scenario: SupportStatusLegalScenario) {
  return scenario.startsWith('legal-');
}

export function SupportStatusLegalJourney({
  scenario = 'support-valid',
}: {
  scenario?: SupportStatusLegalScenario;
}) {
  const activeSupport = useMemo(() => isSupportScenario(scenario), [scenario]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 overflow-x-hidden p-4 text-foreground">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">
          OP Sepolia support, status, security, and legal journey
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Optimism Sepolia support, status, security, and legal journey
        </h1>
        <p data-testid="pinned-release" className="text-xs text-muted-foreground">
          Pinned release {PINNED_RELEASE.releaseId} · protocol{' '}
          {PINNED_RELEASE.protocolVersion} · chain {PINNED_RELEASE.chainId} ·
          commit {PINNED_RELEASE.gitCommit}
        </p>
        <p data-testid="journey-scenario" className="text-xs text-muted-foreground">
          Scenario: {scenario}
        </p>
      </header>

      {activeSupport && <SupportSection scenario={scenario} />}
      {isStatusScenario(scenario) && <StatusSection scenario={scenario} />}
      {isLegalScenario(scenario) && <LegalSection scenario={scenario} />}
      {scenario === 'consent' && <ConsentSection />}
      {scenario === 'disclosures' && <DisclosureSection />}
    </div>
  );
}

export default SupportStatusLegalJourney;
