# Route-to-Capability Conformance (UI-FE-087)

This boundary converts the approved protocol route and capability authority
into deterministic test fixtures and executable conformance tests.

It does **not** grant authority at runtime. The fixtures are test-only and
production code must never import them.

## Authority source

| Source | Pinned reference |
|---|---|
| Protocol repository | `DigiNodes/truthbounty-protocol` |
| Authority commit | `60c66b78cf797d8f821089c99ae1bc461009fecc` |
| Route contract | `docs/ux-authority/SITEMAP_AND_ROUTE_CONTRACT.md` |
| Role/capability matrix | `docs/ux-authority/ROLE_AND_CAPABILITY_MATRIX.md` |
| Implementation matrix | `docs/ux-authority/FRONTEND_IMPLEMENTATION_MATRIX.md` |
| Application shell/navigation | `docs/ux-authority/APP_SHELL_AND_NAVIGATION.md` |

The pinned commit is exported as `PROTOCOL_AUTHORITY_COMMIT` so a future
authority refresh is an explicit, reviewable change.

## Fixtures

| Module | Contents |
|---|---|
| `src/testing/fixtures/authority/capability-authority.ts` | Approved contexts, 16 capability rows, matrix cells, evidence fixtures, fail-closed resolver |
| `src/testing/fixtures/authority/route-authority.ts` | 29 canonical routes, 58 approved boards, navigation groups, read rules, mutation controls, legacy redirects, shipped-route classifications |
| `src/testing/fixtures/authority/index.ts` | Test-only barrel |

### Capability contexts

- `visitor` — anonymous public visitor
- `claimant` — connected claimant
- `verifier` — eligible verifier
- `operations-administrator` — bounded operational authority
- `governance-operator` — timelocked governance authority
- `emergency-guardian` — operation-scoped pause authority

### Required fixtures

`AUTHORITY_FIXTURES` contains one deterministic fixture for each required
context and failure mode:

`anonymous`, `claimant`, `verifier`, `operations`, `governance`, `guardian`,
`revoked`, `stale`, `wrong-chain`, `unavailable`.

Each fixture carries explicit evidence: wallet/session, chain, release
freshness, authority availability, roles, own-resource scope, explicit grants,
and revoked capabilities.

**`activeContext` is presentation-only.** `selectActiveContext()` changes the
view label; capability and route resolution intentionally ignore it.

## Resolution rules

`resolveCapability(capability, fixture)`:

1. Public browse/connect capabilities are available to every context.
2. Prohibited capabilities (`override-truth-outcomes`,
   `move-another-users-funds`) are always denied, even when authority is
   unavailable.
3. Missing authority source → `unavailable`.
4. Revoked capability → `denied`.
5. Missing wallet/session, unsupported chain, or stale release → `denied`.
6. Otherwise apply the matrix cell:
   - `yes` → granted;
   - `no` / `prohibited` → denied;
   - `read-only` → read-only (never a mutation);
   - `own` → granted only for the wallet's own resource;
   - `conditional` → granted only with explicit role/scope evidence.

`evaluateRouteRead(route, fixture)` fails closed on audience mismatch, missing
authority, stale release, wrong chain, revocation, or missing capability.

`allowedMutationControls(route, fixture)` exposes a control only when its exact
capability resolves to `granted`; read-only grants never expose a mutation.

## Route inventory rule

`DISCOVERED_ROUTE_CLASSIFICATIONS` maps every shipped `page.tsx` route to one
of:

- `canonical` — implemented canonical destination;
- `legacy-alias` — redirects to a canonical destination;
- `internal-redirect` — existing intermediate redirect;
- `internal-harness` — test/preview route, never public authority.

The conformance test walks `src/app/**/page.tsx`. **A new route fails CI until
it is classified here.** Canonical routes may remain `planned` or
`unavailable`; support/legal and other authority-gated surfaces do not need to
be implemented to be mapped.

## Board references

`APPROVED_BOARDS` pins all 58 approved frontend boards. Tests assert:

- every route `boardRefs` path is approved;
- every non-global board is referenced by at least one route;
- global foundation/system boards are listed in `GLOBAL_BOARD_REFS`;
- every route has either board references or an explicit
  `boardAuthority: 'sitemap-only'` reason.

## Legacy redirects

Authority aliases preserve query and hash:

| Legacy route | Canonical destination |
|---|---|
| `/verifier` | `/dashboard/verifications` |
| `/rewards` | `/dashboard/rewards` |
| `/identity` | `/settings/identity` |
| `/how-it-works` | `/docs` |
| `/treasury/stake` | `/treasury` |

A redirect never grants a capability; the conformance suite re-evaluates the
destination with the same evidence.

## Tests

| Test | Coverage |
|---|---|
| `capability-matrix.test.ts` | Matrix completeness, every fixture, prohibited capabilities, explicit-grant conditions, context-selection non-granting |
| `route-inventory.test.ts` | Filesystem route discovery, unmapped-route failure, board completeness, redirects |
| `route-capability-conformance.test.ts` | Public/protected reads, all required contexts, mutation controls, navigation, redirects, stale/unavailable handling |

## Adding a route

1. Add the canonical route to `CANONICAL_ROUTE_EXPECTATIONS` with audience,
   read rule, navigation group, mutation controls, board refs, and
   implementation status.
2. Add the shipped `page.tsx` pattern to
   `DISCOVERED_ROUTE_CLASSIFICATIONS` (or fail the inventory test).
3. If it is a legacy alias, add it to `LEGACY_ROUTE_REDIRECTS` and the
   destination's `aliases`.
4. Add or update conformance expectations for the affected contexts.
5. Update the pinned protocol authority commit only after maintainer approval.
