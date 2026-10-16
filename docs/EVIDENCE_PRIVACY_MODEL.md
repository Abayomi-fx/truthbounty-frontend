# Evidence Metadata Privacy Model

> **Part of:** V2-FE Evidence Privacy Protection
> **Companion to:** [THREAT_MODEL.md](./THREAT_MODEL.md), [UI_STATE_MODEL.md](./UI_STATE_MODEL.md)

---

## 1. Purpose

This document defines privacy protections for evidence metadata in the TruthBounty frontend. Evidence URLs, file names, IPFS CIDs, and timestamps can reveal:

- **Infrastructure details**: Private domain names, internal paths, API endpoints
- **Tracking identifiers**: Session tokens, user IDs, tracking parameters in query strings
- **Temporal patterns**: Precise submission times enabling correlation across claims
- **Content metadata**: File names, IPFS CIDs linkable across multiple claims

The protections ensure evidence remains verifiable while minimizing metadata exposure.

---

## 2. Threat Model

### 2.1 Actors

- **Passive observer**: Views claim details, evidence links in UI
- **Active attacker**: Scrapes claims, correlates evidence across multiple claims
- **Analytics/telemetry**: Could log evidence URLs to third-party services

### 2.2 Assets to Protect

| Asset | Exposure Risk | Impact |
|-------|---------------|--------|
| Full URLs | Session tokens, API keys in query params | High |
| File names | Document titles reveal content details | Medium |
| IPFS CIDs | Cross-claim linkability, content tracking | High |
| Exact timestamps | Temporal correlation, user behavior | Medium |
| Domain names | Infrastructure mapping | Low-Medium |
| Path segments | Directory structure, user IDs | Medium |

### 2.3 Out of Scope

- **On-chain data**: Evidence hashes/CIDs already public on Optimism
- **API projection data**: Backend already has full URLs for validation
- **Authenticated users**: Can expand URLs via explicit UI interaction
- **Protocol security**: Evidence sanitization (XSS, unsafe schemes) is separate

---

## 3. Privacy Protection Rules

### 3.1 URL Display Truncation

**Rule:** Evidence URLs in claim views show domain + abbreviated path.

**Format:**
```
Full URL: https://example.com/api/v2/documents/user123/evidence.pdf?token=abc&session=xyz
Display:  example.com/.../evidence.pdf
```

**Algorithm:**
1. Parse URL, extract hostname
2. Remove query parameters and hash fragment
3. Extract filename from path (last segment after `/`)
4. If path has ≥3 segments, replace middle with `...`
5. Show: `{hostname}/.../filename` or `{hostname}/...` if no filename

**Special cases:**
- Root path (`/`): Show `{hostname}/`
- No filename: Show `{hostname}/...`
- IPFS URLs: Apply CID truncation (see 3.2)

### 3.2 IPFS CID Truncation

**Rule:** IPFS CIDs show first 8 and last 6 characters.

**Format:**
```
Full CID: QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk
Display:  Qm...8xFk (IPFS)
```

**Algorithm:**
1. Detect `ipfs://` scheme or `/ipfs/` path
2. Extract CID (base58 string starting with `Qm`)
3. Show: `{first8}...{last6} (IPFS)`
4. Include "(IPFS)" label for clarity

### 3.3 Query Parameter Stripping

**Rule:** All query parameters removed from display URLs.

**Rationale:** Query params frequently contain:
- Session tokens: `?session=abc123`
- API keys: `?apikey=secret`
- Tracking IDs: `?utm_source=campaign&ref=123`
- User identifiers: `?user=alice&id=789`

**Exceptions:** None. All query params stripped for display.

### 3.4 Timestamp Generalization

**Rule:** Evidence timestamps show relative time, not exact ISO strings.

**Format:**
```
Exact:    2026-09-27T14:35:22.123Z
Display:  ~2h ago
```

**Granularity:**
- < 1 hour: `~{minutes}m ago`
- 1-24 hours: `~{hours}h ago`
- 1-7 days: `~{days}d ago`
- > 7 days: `~{weeks}w ago`
- > 4 weeks: Date only (no time)

**Rationale:** Precise timestamps enable correlation. Relative time sufficient for UX.

### 3.5 Evidence ID Hashing (Telemetry Only)

**Rule:** Evidence IDs hashed before logging to telemetry.

**Algorithm:**
1. Hash evidence ID with SHA-256
2. Truncate to first 16 hex chars
3. Prefix with `ev_` for identification
4. Log as: `ev_{hash16}`

**Context:** Display shows evidence IDs as-is (opaque UUIDs). Telemetry gets hashed version.

---

## 4. Display vs. Clipboard

### 4.1 Principle

**Display (visible):** Truncated, privacy-preserving format  
**Clipboard (copy):** Full, unmodified URL for verification

**Rationale:** Users need full URLs for:
- Manual verification of evidence
- Sharing with trusted parties
- Browser navigation

But passive observers should not see full URLs.

### 4.2 Implementation

```tsx
<a
  href={fullUrl}
  onClick={(e) => {
    e.preventDefault();
    navigator.clipboard.writeText(fullUrl);
    // Show "Copied!" toast
  }}
  title="Click to copy full URL"
>
  {truncatedUrl}
</a>
```

**Accessibility:** 
- `aria-label`: Includes note about truncation
- Tooltip: Shows "Click to copy full URL (truncated for privacy)"

---

## 5. Telemetry Redaction

### 5.1 Evidence Fields Never Logged

The following evidence fields **must never** appear in telemetry unredacted:

- `evidence.value` (full URL)
- `evidence.type` (only generic "link" logged, not full URL)
- Query parameters from any evidence URL
- File names (unless user explicitly reports an issue)

### 5.2 Safe to Log

- Evidence ID (hashed via SHA-256, truncated to 16 chars)
- Evidence type (generic: "link", "image", "text")
- Timestamp (generalized to hour)
- Truncated display format (domain + `...`)

### 5.3 Error Logging

When evidence validation fails:

```typescript
// ❌ NEVER:
console.error('Invalid evidence URL:', evidence.value);

// ✅ ALWAYS:
console.error('Invalid evidence URL', {
  evidenceId: hashEvidenceId(evidence.id),
  type: evidence.type,
  reason: 'invalid_scheme', // Generic error code only
});
```

---

## 6. User Controls

### 6.1 Expand Full URL

**Trigger:** Click on truncated URL link

**Behavior:**
1. Copy full URL to clipboard
2. Show toast: "Full URL copied to clipboard"
3. Display remains truncated (privacy-by-default)

**Alternative (Hover):**
- Tooltip shows full URL on hover (desktop only)
- Mobile: Tap to copy (no tooltip)

### 6.2 Opt-Out

**Not provided.** Privacy protections are always active.

**Rationale:** 
- Evidence is on-chain and verifiable via full URL (clipboard)
- Passive observers should not casually see metadata
- No user preference to "show full URLs" (anti-pattern)

---

## 7. Component Boundaries

### 7.1 Display Components

| Component | Privacy Treatment |
|-----------|-------------------|
| `ClaimContent` | Truncated URLs, relative timestamps |
| `ClaimDetailView` | Truncated URLs in evidence section |
| `EvidenceLinks` | Truncated URLs with copy-to-clipboard |
| `SafeExternalLink` | Full URL in `href`, truncated in text |

### 7.2 Utility Functions

| Function | Purpose |
|----------|---------|
| `truncateEvidenceUrl()` | URL truncation algorithm |
| `truncateIpfsCid()` | IPFS CID truncation |
| `stripQueryParams()` | Remove query parameters |
| `formatRelativeTime()` | Timestamp generalization |
| `hashEvidenceId()` | Evidence ID hashing for telemetry |
| `redactEvidenceForTelemetry()` | Full evidence redaction |

---

## 8. Testing Requirements

### 8.1 Unit Tests

- ✅ URL truncation (domains, paths, filenames)
- ✅ IPFS CID truncation
- ✅ Query parameter stripping
- ✅ Relative time formatting
- ✅ Evidence ID hashing
- ✅ Telemetry redaction

### 8.2 Component Tests

- ✅ Truncated URLs render correctly
- ✅ Full URLs in clipboard on click
- ✅ Tooltips show full URLs
- ✅ Relative timestamps display
- ✅ IPFS links labeled correctly

### 8.3 Integration Tests

- ✅ No evidence URLs in telemetry logs
- ✅ Error messages redact URLs
- ✅ Console logs redact evidence values
- ✅ Analytics events include hashed IDs only

### 8.4 Regression Tests

- ✅ URL truncation doesn't break SafeExternalLink security
- ✅ Evidence sanitization still applied
- ✅ No XSS via truncation logic
- ✅ Clipboard API works cross-browser

---

## 9. Examples

### 9.1 HTTPS URL

```
Input:  https://internal-docs.company.com/api/v2/files/user_alice_123/report_confidential.pdf?token=abc123&session=xyz789

Output:
  Display:  internal-docs.company.com/.../report_confidential.pdf
  Tooltip:  Click to copy full URL (truncated for privacy)
  Clipboard: https://internal-docs.company.com/api/v2/files/user_alice_123/report_confidential.pdf?token=abc123&session=xyz789
```

### 9.2 IPFS URL

```
Input:  ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk/path/to/file.json

Output:
  Display:  Qm...8xFk (IPFS)
  Tooltip:  Click to copy full CID (truncated for privacy)
  Clipboard: ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk/path/to/file.json
```

### 9.3 Timestamp

```
Input:  2026-09-27T14:35:22.123Z (exactly 2 hours 15 minutes ago)

Output:
  Display:  ~2h ago
  Tooltip:  Evidence submitted approximately 2 hours ago
```

### 9.4 Telemetry Event

```typescript
// Evidence validation error
{
  event: 'evidence_validation_error',
  evidenceId: 'ev_a1b2c3d4e5f6g7h8', // Hashed
  type: 'link',
  error: 'invalid_scheme',
  // ❌ NOT INCLUDED: evidence.value, full URL, query params
}
```

---

## 10. Migration Strategy

### 10.1 Backward Compatibility

**Existing components:** Display full URLs currently.

**Migration path:**
1. Add utility functions (non-breaking)
2. Update components to use truncated display
3. Add clipboard copy handlers
4. Update tests
5. Deploy (all users see truncated URLs)

**No flag/feature toggle:** Privacy protections are not optional.

### 10.2 Rollout Verification

- Monitor telemetry for evidence URL leaks (should be zero)
- Check console logs for unredacted URLs (should be zero)
- Verify clipboard copy works across browsers
- User feedback: "Can't see full URL" → Guide to clipboard

---

## 11. References

- [THREAT_MODEL.md](./THREAT_MODEL.md) — Overall security model
- [UI_STATE_MODEL.md](./UI_STATE_MODEL.md) — UI state handling
- `src/lib/security/evidence-sanitizer.ts` — XSS/security sanitization (separate concern)
- `src/lib/security/redaction.ts` — Telemetry redaction (extends with evidence-specific rules)

---

## 12. Acceptance Criteria

- ✅ Evidence URLs display truncated in all claim views
- ✅ Full URLs available via clipboard on click
- ✅ IPFS CIDs truncated with "(IPFS)" label
- ✅ Query parameters never shown in display
- ✅ Timestamps show relative time, not exact ISO
- ✅ Evidence IDs hashed in telemetry
- ✅ No evidence.value in logs, errors, or analytics
- ✅ Tooltips show "truncated for privacy" message
- ✅ All tests pass (unit, component, integration, regression)
- ✅ Documentation updated with privacy requirements
