'use client';

import { Plus, X } from 'lucide-react';
import type {
  DisputeEvidenceEntry as DisputeEvidenceEntryValue,
  EvidenceProblem,
} from '@/app/types/dispute-entry';

export interface DisputeEvidenceEntryProps {
  entries: DisputeEvidenceEntryValue[];
  /** Integrity problems, each tagged with its entry index. */
  problems: EvidenceProblem[];
  disabled?: boolean;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<DisputeEvidenceEntryValue>) => void;
  onRemove: (index: number) => void;
}

/**
 * Evidence-link entry rows for the dispute composition. Links are treated as
 * untrusted input: every integrity problem (unsupported scheme,
 * credential-bearing URI, malformed digest…) is surfaced inline under the
 * offending row with `role="alert"` and blocks submission.
 */
export function DisputeEvidenceEntry({
  entries,
  problems,
  disabled = false,
  onAdd,
  onChange,
  onRemove,
}: DisputeEvidenceEntryProps) {
  const problemsFor = (index: number) =>
    problems.filter((problem) => problem.entryIndex === index);
  const setLevelProblems = problems.filter(
    (problem) => problem.entryIndex === null
  );

  return (
    <fieldset
      data-testid="dispute-evidence-entry"
      className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
    >
      <legend className="px-1 text-sm font-medium text-zinc-300">
        Evidence links (optional)
      </legend>

      <p className="mb-2 text-xs text-zinc-400">
        Only https and ipfs links are accepted. Links containing credentials
        are rejected and never stored.
      </p>

      <ul className="space-y-3">
        {entries.map((entry, index) => {
          const entryProblems = problemsFor(index);
          const uriId = `dispute-evidence-uri-${index}`;
          const digestId = `dispute-evidence-digest-${index}`;
          return (
            <li
              key={index}
              data-testid={`dispute-evidence-row-${index}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <label
                  htmlFor={uriId}
                  className="block text-xs font-medium text-zinc-400"
                >
                  Evidence link {index + 1}
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={disabled}
                  aria-label={`Remove evidence link ${index + 1}`}
                  className="rounded p-1 text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:opacity-50 motion-reduce:transition-none"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <input
                id={uriId}
                type="url"
                inputMode="url"
                value={entry.uri}
                disabled={disabled}
                onChange={(event) => onChange(index, { uri: event.target.value })}
                placeholder="https://example.com/evidence or ipfs://…"
                aria-invalid={entryProblems.length > 0}
                aria-describedby={entryProblems.length > 0 ? `${uriId}-problems` : undefined}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-base text-white placeholder:text-zinc-600 focus:border-red-500 focus:outline-none disabled:opacity-60"
              />
              <label
                htmlFor={digestId}
                className="mt-2 block text-xs font-medium text-zinc-400"
              >
                SHA-256 digest (optional)
              </label>
              <input
                id={digestId}
                type="text"
                value={entry.digest ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange(index, { digest: event.target.value })
                }
                placeholder="sha256 hex digest of the linked content"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 font-mono text-sm text-white placeholder:font-sans placeholder:text-zinc-600 focus:border-red-500 focus:outline-none disabled:opacity-60"
              />
              {entryProblems.length > 0 && (
                <div
                  id={`${uriId}-problems`}
                  role="alert"
                  data-testid={`dispute-evidence-problems-${index}`}
                  className="mt-2 rounded-lg border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-300"
                >
                  <ul className="space-y-1">
                    {entryProblems.map((problem, problemIndex) => (
                      <li key={problemIndex}>{problem.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {setLevelProblems.length > 0 && (
        <div
          role="alert"
          data-testid="dispute-evidence-set-problems"
          className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-300"
        >
          <ul className="space-y-1">
            {setLevelProblems.map((problem, index) => (
              <li key={index}>{problem.message}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:opacity-50 motion-reduce:transition-none"
      >
        <Plus size={16} aria-hidden="true" />
        Add evidence link
      </button>
    </fieldset>
  );
}

export default DisputeEvidenceEntry;
