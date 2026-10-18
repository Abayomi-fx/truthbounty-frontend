'use client';

/**
 * DeferredMedia — click-to-load image for reduced-data / constrained networks
 * (UI-FE-082).
 *
 * Under the global reduced-data policy this component replaces automatic
 * `<img>` loads with a lightweight, keyboard-accessible placeholder. Users
 * explicitly opt in to fetching a given asset, which keeps page weight and
 * transfer volume low on metered or slow connections. When data saving is off,
 * it renders a normal lazy image so existing behaviour is unchanged.
 *
 * Asset loading is the ONLY thing deferred: the surrounding evidence/claim
 * integrity validation still runs before this component is reached.
 */

import { useEffect, useState } from 'react';
import { ImageOff, ImageIcon } from 'lucide-react';
import { useReducedData } from '@/hooks/useReducedData';

export interface DeferredMediaProps {
  /** Validated, safe image URL (callers must sanitize before passing). */
  src: string;
  /** Meaningful alternative text. Required — deferral must not hide meaning. */
  alt: string;
  className?: string;
  placeholderClassName?: string;
  /** Native lazy-loading hint when the image is actually rendered. */
  loading?: 'lazy' | 'eager';
  referrerPolicy?: React.ComponentProps<'img'>['referrerPolicy'];
  /** Optional aspect-ratio CSS value for the placeholder box. */
  aspectRatio?: string;
  /** Optional callback when the image fails to load. */
  onError?: () => void;
}

export function DeferredMedia({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  loading = 'lazy',
  referrerPolicy = 'no-referrer',
  aspectRatio,
  onError,
}: DeferredMediaProps) {
  const { shouldDeferRichMedia } = useReducedData();
  const [activated, setActivated] = useState(!shouldDeferRichMedia);
  const [failed, setFailed] = useState(false);
  const defer = shouldDeferRichMedia && !activated;

  // If data saving is turned off after mount, stop deferring automatically.
  useEffect(() => {
    if (!shouldDeferRichMedia) setActivated(true);
  }, [shouldDeferRichMedia]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const boxStyle = aspectRatio ? { aspectRatio } : undefined;

  if (defer) {
    return (
      <button
        type="button"
        onClick={() => setActivated(true)}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 bg-gray-800/40 px-4 py-6 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${placeholderClassName}`}
        style={boxStyle}
        aria-label={`Load image: ${alt}. Data saver is on.`}
        data-testid="deferred-media-placeholder"
      >
        <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Load image</span>
      </button>
    );
  }

  if (failed) {
    return (
      <span
        className={`inline-flex w-full items-center gap-2 rounded-lg border border-[#232329] bg-gray-800/40 px-4 py-6 text-sm text-gray-400 ${placeholderClassName}`}
        style={boxStyle}
        role="note"
        data-testid="deferred-media-error"
      >
        <ImageOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Image unavailable</span>
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={className}
      style={boxStyle}
      loading={loading}
      referrerPolicy={referrerPolicy}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
      data-testid="deferred-media-image"
    />
  );
}

export default DeferredMedia;
