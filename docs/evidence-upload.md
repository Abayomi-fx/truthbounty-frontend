# Evidence upload: preflight, progress and recovery

This document defines the reusable evidence-upload boundary: the preflight validation that runs before any network transfer, the transfer state machine, and the recovery rules that keep upload success distinct from on-chain attachment.

The contracts and reviewed API projections remain authoritative. Remote content, browser state, wallet data, and user input are treated as untrusted. The boundary fails closed on missing, stale, ambiguous, wrong-chain, wrong-release, or denied state.

## Preflight validation

Preflight runs before any byte is sent to the network. It validates the candidate against the active evidence policy and rejects invalid evidence without transfer.

| Check | Rule | Rejection code |
|---|---|---|
| File count | At least one file and no more than the policy maximum. | `empty-selection`, `too-many-files` |
| File size | Each file is non-zero and within the policy minimum and maximum. | `empty-file`, `too-large` |
| MIME type | The declared MIME type is in the policy allowlist. | `unsupported-type` |
| Extension | The file extension matches the declared MIME type and the policy allowlist. | `extension-mismatch` |
| MIME content | The detected content type matches the declared MIME type. | `mime-mismatch` |
| Duplicate selection | The same file is not already selected in this upload set. | `duplicate-selection` |
| Hash | The local SHA-256 digest is computed and matches the digest the canonical layer reports. | `hash-mismatch` |
| Evidence policy | The active evidence policy is present, not stale, and allows the claim context. | `policy-missing`, `policy-stale`, `policy-denied` |

A rejection from preflight is terminal for the candidate. No upload request is made and no evidence record is created.

## States

idle → hashing → uploading → pinning → verifying → verified | failed | cancelled | invalidated

Each stage is separate and observable:

- **Hashing** is local only. It produces the local SHA-256 digest and never touches the network.
- **Uploading** transfers bytes to the canonical layer. Progress is bytes sent and is capped at 99% until the canonical layer's digest matches the local SHA-256.
- **Pinning** requests pinning and waits for the pinned CID. Pinning is not attachment.
- **Verifying** confirms the CID resolves to the uploaded bytes and that the claim authorization is valid for the active wallet account and chain.
- **Verified** means the evidence is available and authorized for claim submission. Only `verified` allows claim submission.

## Upload success vs. on-chain attachment

Upload success and on-chain attachment are distinct events and must not be conflated in UI, logs, or telemetry:

- A completed transfer with a matching digest and a pinned CID is **evidence available**. It is not an attachment.
- An attachment only exists after the canonical layer confirms the claim references the verified CID.
- The UI must never label an uploaded file as "attached" or "claimed" before the canonical confirmation is observed.

## Failures

| Failure | Retry? | User action |
|---|---|---|
| network, stale | Yes | Retry without re-picking the file |
| rejected, too-large, unsupported-type | No | Choose another file |
| integrity-mismatch | No | Choose the file again; nothing was accepted |
| gateway timeout | Yes | Retry with the same candidate; the canonical layer deduplicates by digest |
| authorization denied | No | Reconnect the authorized wallet and restart preflight |

Retries are bounded and idempotent. Each retry sends the same local digest and the same candidate identifier, so the canonical layer can deduplicate by digest and a retry cannot create a duplicate evidence record. A new file selection starts a new candidate identifier.

## Wallet changes

An account or chain change aborts the upload and invalidates it. The user must choose the file again. Invalidation is terminal for the candidate and no claim authorization is carried across the change.

## Accessibility

Affected interactions meet WCAG 2.2 AA:

- File selection is operable by keyboard alone and exposes an accessible name and description.
- State changes are announced to assistive technology through a live region that reports the current stage and progress.
- Progress is exposed as a determinate value with a text equivalent; the 99% cap is not communicated as completion.
- Errors are announced with the failure code and the recoverable action, and focus moves to the retry or reselect control.
- Color is never the only carrier of status or error information.

## Privacy

File names, contents and digests are never logged or sent to telemetry.

## Known limits
Hashing reads the whole file into memory.
