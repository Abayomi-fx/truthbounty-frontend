'use client';

import { useEffect, useRef } from 'react';
import type { FormErrorSummaryItem } from '@/components/ui/FormErrorSummary';

export function useFormErrorSummary(errors: readonly FormErrorSummaryItem[]) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (errors && errors.length > 0 && ref.current) {
      ref.current.focus();
    }
  }, [errors]);

  return ref;
}
