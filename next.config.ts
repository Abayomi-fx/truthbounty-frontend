import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
import {
  buildStaticSecurityHeaders,
  buildApiSecurityHeaders,
  CACHE_CONTROL_POLICIES,
} from "./src/lib/security/headers";
import { assertProductionEnv } from "./src/app/lib/env";

const staticSecurityHeaders = Object.entries(buildStaticSecurityHeaders()).map(
  ([key, value]) => ({ key, value }),
);

// Fail closed on invalid required configuration during production builds.
// Local/test defaults are explicit and non-production.
assertProductionEnv(process.env);

const apiSecurityHeaders = Object.entries(buildApiSecurityHeaders()).map(
  ([key, value]) => ({ key, value }),
);

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['wagmi', '@wagmi/core', '@wagmi/connectors', 'viem'],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders,
      },
      {
        source: "/api/:path*",
        headers: apiSecurityHeaders,
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: CACHE_CONTROL_POLICIES.staticAssets },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);