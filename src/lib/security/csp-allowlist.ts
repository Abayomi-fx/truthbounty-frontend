/** Compatibility facade: the middleware and legacy callers use one policy. */
import { buildContentSecurityPolicy, NONCE_HEADER } from './headers';
import { providerSources, assertReviewedEndpoint } from './provider-policy.mjs';

export const DEFAULT_CSP_ALLOWLIST = {
  connectSrc: providerSources('connect-src'),
  scriptSrc: [] as string[],
  styleSrc: providerSources('style-src'),
  imgSrc: providerSources('img-src'),
  frameSrc: providerSources('frame-src'),
};
export type CspAllowlist = typeof DEFAULT_CSP_ALLOWLIST;
export interface RenderCspOptions {
  readonly nonce: string;
  readonly envConnectUrls?: readonly string[];
  readonly envImgUrls?: readonly string[];
  readonly development?: boolean;
}
export function renderCspHeader(options: RenderCspOptions): string {
  for (const url of options.envConnectUrls ?? []) assertReviewedEndpoint(url, 'connect-src', options.development);
  for (const url of options.envImgUrls ?? []) assertReviewedEndpoint(url, 'img-src', options.development);
  return buildContentSecurityPolicy({ nonce: options.nonce, isDevelopment: options.development });
}
export const CSP_NONCE_HEADER = NONCE_HEADER;
