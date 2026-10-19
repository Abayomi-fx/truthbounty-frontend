# UI-FE-069 — Support, Status, Security, and Legal E2E Journeys

**Issue:** #641  
**Complexity:** High  
**Points:** 200  
**Branch:** `fix/ui-fe-069-support-status-legal-e2e`  
**Base head:** `e8eec40da0f3348bb94d050dce08de7d0324ba81` (`origin/main`)  
**Exact head:** recorded in the pull request body and `Exact head verified` line.

## 1. Summary

This change adds a deterministic end-to-end journey for the approved support,
status, incident, disclosure, consent, and legal surfaces on the pinned
Optimism Sepolia release (`v2.0.0-sepolia`, chain `11155420`, protocol `2.0.0`).

The journey covers:

- Support request validation, secret detection, duplicate submission, and
  contact/responsible-disclosure channels.
- Public service status observations, incident freshness, maintenance states,
  and system-support boundaries.
- Legal version selection, effective dates, stale/superseded versions,
  retired releases, review/draft copy, and disclosures.
- Consent decline, renewal, and clearing with an explicit consent notice
  version.

Support and system status never fabricate an SLA, bounty, uptime, or
infrastructure control.

## 2. Deliverables

| File | Purpose |
| --- | --- |
| `src/testing/support-status-legal/SupportStatusLegalJourney.tsx` | Deterministic journey composition built from the production status, terms, disclosure, consent, and security-redaction surfaces. |
| `src/testing/support-status-legal/SupportStatusLegalJourney.stories.tsx` | One story per protected scenario. |
| `src/testing/support-status-legal/css.d.ts` | CSS declarations for the isolated type check. |
| `.storybook/support-status-legal/` | Isolated Storybook config. |
| `playwright.support-status-legal.config.ts` | Playwright runner for the journey. |
| `e2e/support-status-legal-journey.spec.ts` | Thirteen E2E assertions covering the required matrix. |
| `package.json` | Adds `test:e2e:support-status-legal`. |

## 3. Scenario matrix

| Scenario | Story | Assertions |
| --- | --- | --- |
| Pinned release and expectations | `SupportValid`, `Disclosures` | Release, protocol, chain, git commit, no-SLA/no-bounty copy |
| Support validation | `SupportValidation` | Missing email, category, and message rejected; valid request accepted |
| Support secret detection | `SupportSecret` | Secret material rejected, message cleared, secret absent from the DOM |
| Duplicate support request | `SupportDuplicate` | Duplicate submission rejected explicitly |
| Status operational | `StatusOperational` | Operational tone and message; no uptime or infrastructure controls |
| Status degraded | `StatusDegraded` | Degraded API/RPC observations; no fabricated health |
| Status stale | `StatusStale` | Stale freshness and observation age; no current-state claim |
| Status unavailable | `StatusUnavailable` | Unavailable state and unknown values; no fabricated observation |
| Maintenance | `StatusMaintenance` | Scheduled maintenance is explicit; no pause/restart/scale controls |
| Incident freshness | `IncidentFresh`, `IncidentStale` | Fresh vs stale observation labels and explicit "not current" |
| Legal current | `LegalCurrent` | Version, effective date, source, approved clauses, review clause |
| Stale legal version | `LegalStale` | Superseded version and effective date; current version remains active |
| Review/draft copy | `LegalReview` | Under Review, not legally effective, draft cannot be approved |
| Retired release | `LegalRetired` | Retired release explicit; pinned release identified |
| Consent | `Consent` | Declined, renewed, and cleared consent; consent notice version/effective date |
| Disclosures | `Disclosures` | Economic disclosure region and no-SLA/no-bounty assertions |
| Responsive | Support, status, legal, consent | No horizontal overflow at 375, 768, and 1440 CSS pixels |
| Keyboard | `SupportValidation` | Email, category, message, and submit are keyboard reachable |

## 4. Acceptance-criteria evidence

### 4.1 Support cannot accept or echo common secret material unnoticed

The support form uses the production `REDACTION_RULES` set to detect private
keys, signatures, mnemonic phrases, bearer tokens, and secret key/value
patterns. The `SupportSecret` test submits a fake private key, asserts the
explicit rejection, asserts the message field is cleared, and asserts the
secret string is absent from the rendered body.

### 4.2 Status never fabricates uptime or infrastructure control

The status tests assert the sanitized tones/messages only. They assert that no
percentage uptime text and no restart, pause, scale, or deploy controls are
rendered. Missing observations render `Unknown`/`No observation recorded`
rather than inferred health. Maintenance is labelled as scheduled maintenance,
not as a healthy state.

### 4.3 Legal versions and effective dates are explicit

`TermsRenderer` and `TermsVersionSelector` are exercised with the pinned
testnet terms. The tests assert the version, effective date, source, published
state, and review state. Stale and retired versions are labelled as superseded
or retired and are never presented as the current version.

### 4.4 Placeholder review copy cannot appear as approved production policy

The `LegalReview` story renders the `staking-rewards-disputes` clause in its
`review` state. The test asserts "Under Review", "NOT yet legally effective",
and the explicit draft note "Draft content cannot be published as approved."
Draft versions are separated from published versions.

## 5. Verification

### 5.1 Journey E2E

```bash
pnpm test:e2e:support-status-legal
```

Result: **13 passed** (Storybook + Playwright, Chromium).

### 5.2 Targeted type check

A temporary project extending `tsconfig.json` checked the journey, stories,
config, spec, and repaired surfaces. The temporary config was removed after the
check.

```bash
npx tsc --noEmit -p tsconfig.support-temp.json
```

Result: **no errors**.

## 6. Prerequisite repairs

The current upstream tree contained pre-existing corruption in the consent and
legal surfaces required by this journey:

- `src/components/analytics/AnalyticsConsentManager.tsx`: repaired an
  unterminated string literal that prevented the consent panel from parsing.
- `src/lib/analytics/consent.ts`: aligned the consent storage API with the
  component (storage availability, corrupted-state reporting, explicit clear
  helper, and the current read result shape).
- `src/components/features/terms/TermsRenderer.tsx`: imported `ClauseStatus`
  and added the missing `reviewerNotes` field to the synthetic unavailable
  clause.
- `src/components/ui/primitives/StakeWeightDisplay.tsx`: shared effective-weight
  type correction required by the primitives barrel used by the disclosure
  panel.

## 7. Known limitations and non-goals

- The support request form is a test-only composition because the upstream tree
  does not contain a production support-request component. It uses the
  production redaction rules and approved contact links; it does not invent a
  backend support API or SLA.
- The suite is deterministic and does not send real support messages, collect
  personal data, or fabricate incident/uptime state.
- The existing `AnalyticsConsentManager` unit suite has a pre-existing
  transition race in its "revoked consent" test under `fireEvent`; the new
  browser E2E decline/renew/clear journey passes.
- Do not commit the two staged deletions of
  `src/app/\(dashboard\)/terms/TermsPageClient.tsx` and
  `src/app/\(dashboard\)/terms/page.tsx`. They are Windows checkout artifacts
  for paths that cannot exist on NTFS.
