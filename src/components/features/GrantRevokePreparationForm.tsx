'use client';

/**
 * GrantRevokePreparationForm — UI-FE-030
 *
 * Builds a *typed* grant/revoke draft and validates it locally. Submission
 * is always disabled here — per #600's acceptance criteria ("No immediate
 * direct role mutation is exposed") and the Action-to-interface gate for
 * governance in FRONTEND_IMPLEMENTATION_MATRIX.md ("No arbitrary call
 * composition" until pinned). This form exists so the operator can see and
 * review exactly what a change would contain before any contract interface
 * exists to submit it against — not to perform the mutation.
 */
import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import type { GrantRevokeDraft } from '@/app/types/governance-roles';

export interface GrantRevokePreparationFormProps {
  disabledReason: string;
  prepareDraft: (input: { action: 'grant' | 'revoke'; roleId: string | null; address: string }) => GrantRevokeDraft;
}

export function GrantRevokePreparationForm({ disabledReason, prepareDraft }: GrantRevokePreparationFormProps) {
  const [action, setAction] = useState<'grant' | 'revoke'>('grant');
  const [address, setAddress] = useState('');
  const [draft, setDraft] = useState<GrantRevokeDraft | null>(null);

  const handlePreview = (event: FormEvent) => {
    event.preventDefault();
    setDraft(prepareDraft({ action, roleId: null, address }));
  };
