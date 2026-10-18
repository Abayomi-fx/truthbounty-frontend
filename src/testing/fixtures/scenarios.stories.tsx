/**
 * UI-FE-088 — Storybook consumer of the canonical scenario catalogue.
 *
 * Every story renders the *same* `CanonicalScenario` objects that the Jest
 * tests and the Playwright spec consume, so a Storybook screenshot, a unit
 * assertion, and an e2e run all describe one shared definition instead of
 * three hand-written copies.
 *
 * Test-only path (`fixtures/`), so `verify-production-boundaries` guarantees
 * none of this reaches the production bundle.
 */

import type { Meta, StoryObj } from '@storybook/react';

import {
  CANONICAL_SCENARIOS,
  getScenario,
  type CanonicalScenario,
  type CanonicalScenarioId,
} from './scenarios';

export interface ScenarioPreviewProps {
  id: CanonicalScenarioId;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-right font-mono text-xs text-gray-200">{value}</dd>
    </div>
  );
}

/** Read-only rendering of one scenario's shared fixture bundle. */
export function ScenarioPreview({ id }: ScenarioPreviewProps) {
  const scenario: CanonicalScenario = getScenario(id);
  const { contract, projection, ui } = scenario;

  return (
    <section
      aria-labelledby={`scenario-${scenario.id}-heading`}
      className="w-[34rem] max-w-full rounded-xl border border-[#232329] bg-[#13141b] p-6"
      data-testid={`scenario-${scenario.id}`}
    >
      <p className="text-xs uppercase tracking-widest text-gray-500">Canonical scenario</p>
      <h2 id={`scenario-${scenario.id}-heading`} className="mt-1 text-lg font-semibold text-white">
        {scenario.label}
      </h2>
      <p className="mt-2 text-sm text-gray-400">{scenario.description}</p>

      <dl className="mt-4 divide-y divide-[#232329]">
        <Field label="View state" value={ui.viewState} />
        <Field
          label="Claims projection"
          value={
            projection.claimsList
              ? `${projection.claimsList.items.length} rows · ${projection.claimsList.projection.freshness}`
              : projection.claimsListError
                ? `error · ${projection.claimsListError.code}`
                : 'none'
          }
        />
        <Field label="Indexer lag" value={`${projection.freshness.freshness.lag} blocks`} />
        <Field
          label="Transaction"
          value={`${contract.transaction.state}${'receipt' in contract.transaction ? ` · ${contract.transaction.receipt.status}` : ''}`}
        />
        <Field label="Finality" value={contract.finality.level} />
        <Field
          label="Route access"
          value={
            ui.routeAccess.isAllowed
              ? 'allowed'
              : `denied · ${ui.routeAccess.denialReason ?? 'unknown'}`
          }
        />
        <Field
          label="Capabilities"
          value={`${Object.values(ui.capabilities).filter(Boolean).length}/5 granted`}
        />
        <Field label="Incident" value={`${ui.incident.severity} · ${ui.incident.message}`} />
        <Field label="Contract release" value={`${contract.release.releaseId} (chain ${contract.release.chainId})`} />
        <Field label="Legal content" value={`${ui.legalContent.id} ${ui.legalContent.version}`} />
        <Field label="Network" value={`${scenario.network.chainName} (${scenario.network.chainId})`} />
      </dl>
    </section>
  );
}

const meta: Meta<typeof ScenarioPreview> = {
  title: 'Testing/Canonical Scenarios',
  component: ScenarioPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    id: {
      control: 'select',
      options: CANONICAL_SCENARIOS,
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScenarioPreview>;

export const Loading: Story = { args: { id: 'loading' } };
export const Empty: Story = { args: { id: 'empty' } };
export const Stale: Story = { args: { id: 'stale' } };
export const Denied: Story = { args: { id: 'denied' } };
export const Offline: Story = { args: { id: 'offline' } };
export const Unavailable: Story = { args: { id: 'unavailable' } };
export const Reverted: Story = { args: { id: 'reverted' } };
export const Replaced: Story = { args: { id: 'replaced' } };
export const IndexingDelayed: Story = { args: { id: 'indexing-delayed' } };
export const Reorged: Story = { args: { id: 'reorged' } };
export const Finalized: Story = { args: { id: 'finalized' } };
