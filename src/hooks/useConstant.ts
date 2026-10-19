'use client';

import { useState } from 'react';

/**
 * Evaluate `factory` exactly once per component instance and keep the result.
 *
 * Release artifacts, canonical roles and resolved configuration are static for
 * the lifetime of a page. Reading them through a plain call during render means
 * every consumer re-creates whatever the getter returns, and any `useMemo` /
 * `useEffect` that depends on such a value is invalidated on every render. When
 * the value feeds an effect that writes state, that becomes an unbounded
 * render → fetch → render loop.
 *
 * `useConstant` pins the identity so downstream memos and effects stay stable
 * even when the underlying getter allocates a fresh object per call. The lazy
 * initialiser runs once, and the state never changes afterwards.
 */
export function useConstant<T>(factory: () => T): T {
  const [value] = useState(factory);
  return value;
}
