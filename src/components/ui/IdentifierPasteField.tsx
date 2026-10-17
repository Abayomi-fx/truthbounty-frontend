'use client';

import { useId, useState, type ClipboardEvent } from 'react';
import {
  validatePastedIdentifier,
  type PasteValidationOptions,
  type PastedIdentifierKind,
} from '@/lib/clipboard';

export interface IdentifierPasteFieldProps extends PasteValidationOptions {
  kind: PastedIdentifierKind;
  label: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

const ERROR_COPY = {
  empty: 'Paste an identifier.',
  'unsafe-characters': 'This value contains unsupported Unicode or hidden characters.',
  whitespace: 'Remove spaces inside the identifier and paste again.',
  'invalid-format': 'This value is not a valid identifier of the selected type.',
  'wrong-chain': 'This address belongs to a different network. Switch networks or paste an address for the expected network.',
} as const;

/** Text field that normalizes and validates pasted public identifiers before accepting them. */
export function IdentifierPasteField({
  kind,
  label,
  expectedChainId,
  currentChainId,
  onValueChange,
  className,
}: IdentifierPasteFieldProps) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const inputId = useId();

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const result = validatePastedIdentifier(kind, event.clipboardData.getData('text'), {
      expectedChainId,
      currentChainId,
    });
    if (!result.ok) {
      setStatus(ERROR_COPY[result.reason]);
      return;
    }
    setValue(result.value);
    setStatus(`${label} validated and ready.`);
    onValueChange?.(result.value);
  };

  return (
    <div>
      <label className="block" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPaste={handlePaste}
        className={className}
        aria-describedby={`${inputId}-status`}
      />
      <span id={`${inputId}-status`} role="status" aria-live="polite" aria-atomic="true">
        {status || `Paste a ${label.toLowerCase()}. Only public identifiers are accepted; never paste secrets.`}
      </span>
    </div>
  );
}
