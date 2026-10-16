# Consent-Aware Minimal Analytics

## User Controls

Analytics is disabled until a user explicitly chooses **Allow optional analytics**. **Reject optional analytics** stores an opt-out, and **Manage analytics preferences** remains available to change that choice. **Not now** closes the prompt without recording consent. A choice is stored only in `localStorage` under `truthbounty:analytics-consent:v1`; no cookie, account identifier, wallet address, or session identifier is created.

The controls are exposed as a labeled region after the main application content. The prompt is keyboard operable, restores focus after it closes, announces storage failures, and remains usable at narrow viewport widths. If browser storage cannot be read or a grant cannot be saved, analytics fails closed and remains disabled.

## State Model

| State | Behavior |
| --- | --- |
| Loading | No event is emitted while the stored choice is being read. |
| Not set | Analytics stays off; the user may allow, reject, or dismiss the prompt. |
| Granted | A page-view event is emitted for the current page and subsequent route changes. |
| Denied | No page-view event is emitted; the preference can be changed later. |
| Storage unavailable | Analytics stays off; granting is disabled and an accessible error is shown. |

Cross-tab storage changes are observed so a revocation in another tab stops subsequent page-view events here as well.

## Event Contract

The allowlisted event is `page_view` with exactly these fields:

```ts
{
  version: 1;
  name: "page_view";
  page: "home" | "app";
  occurredAtMinute: number;
}
```

Path segments, query strings, wallet/account data, claim identifiers, evidence, API responses, and transaction data are not included. The payload is passed through `redactForTelemetry` before dispatch.

Events are dispatched as the same-page `truthbounty:analytics` `CustomEvent`. This checkout has no canonical analytics endpoint or sink: the event is not sent over the network, persisted, or forwarded to a vendor. The referenced `V2-FE-133` interface is not present here. A future sink must use that canonical interface, remain behind the same explicit-consent check, and preserve this minimal allowlist and redaction boundary; do not add an ad hoc endpoint or SDK.

Analytics is best-effort and has no dependency on protocol reads or writes. Failure to read preferences or dispatch an event never changes wallet, chain, transaction, settlement, reward, reputation, or API-projection state.

## Verification

`AnalyticsConsentManager.test.tsx` covers default-off behavior, opt-in payload minimization, rejection, revocation, invalid preferences, storage read/write failures, keyboard activation, and focus restoration. `analytics-consent.test.tsx` runs the controls through the repository's axe accessibility helper.