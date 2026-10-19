import React, { useRef } from "react";
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface Props {
  onClose: () => void;
}

export default function TrustExplanationModal({ onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(true, modalRef, closeButtonRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 modal-shell bg-black/60"
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape/focus-trap keydown handling on the dialog container */}
      <div
        ref={modalRef}
        className="modal-panel bg-[#18181b] border border-[#232329]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trust-modal-title"
        tabIndex={-1}
      >
        <h2 id="trust-modal-title" className="text-2xl font-bold mb-4">How trust and reputation work</h2>
        <p className="mb-2">
          To maintain protocol integrity we compute a simple <strong>trust
          score</strong> for every account. Accounts with low scores are
          treated with extra caution, and dishonest behaviour may result in
          penalties or reduced access.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <strong>Verify your identity</strong> via the on-chain verification
            flow. Until that is complete, your verification weight may remain
            zero and your votes can be ignored.
          </li>
          <li>
            <strong>Build reputation</strong> by submitting accurate claims and
            participating honestly in verifications. Positive feedback raises
            your score over time.
          </li>
          <li>
            <strong>Avoid suspicious patterns</strong> such as creating many
            wallets, submitting conflicting data, or rapid-fire activity.
          </li>
          <li>
            <strong>Be patient with new wallets</strong>. Accounts less than a
            week old start with limited privileges until they have demonstrated
            good behaviour.
          </li>
        </ul>
        <div className="mt-6 text-right">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="bg-[#5b5bf6] text-white px-4 py-2 rounded hover:bg-[#6c6cf7]"
            aria-label="Close trust explanation"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
