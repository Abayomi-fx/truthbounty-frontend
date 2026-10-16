/**
 * Test and Storybook fixtures for dashboard UI components.
 *
 * TEST / STORYBOOK BOUNDARY - DO NOT IMPORT FROM PRODUCTION SOURCE CODE.
 *
 * These arrays were previously exported from src/data/mock-data.ts and leaked
 * into production bundles (V2-FE-138 audit finding). Production components now
 * render explicit loading/unavailable/empty states instead.
 *
 * The ESLint no-restricted-imports rule, verify-production-boundaries.mjs,
 * and no-mock-data-in-production.test.ts all enforce this boundary.
 */

export interface ClaimableRewardFixture {
  claimId: string;
  title: string;
  amount: number;
}

export const platformStatsFixture = [
  { label: "Claims", value: "12,847" },
  { label: "Verifications", value: "9,234" },
  { label: "Votes Cast", value: "847,291" },
  { label: "Unique Verifiers", value: "4,128" },
  { label: "TVL", value: "$2.4M" },
  { label: "Chains", value: "7" },
];

export const activityDataFixture = [
  { name: "Mon", verified: 40, disputed: 24, false: 10 },
  { name: "Tue", verified: 30, disputed: 13, false: 5 },
  { name: "Wed", verified: 20, disputed: 58, false: 12 },
  { name: "Thu", verified: 27, disputed: 39, false: 8 },
  { name: "Fri", verified: 18, disputed: 48, false: 6 },
  { name: "Sat", verified: 23, disputed: 38, false: 4 },
  { name: "Sun", verified: 34, disputed: 43, false: 9 },
];

export const verificationNodesFixture = [
  { name: "Validator #1", status: "Online",      uptime: "99.9%", location: "US-East"   },
  { name: "Validator #2", status: "Online",      uptime: "99.5%", location: "EU-West"   },
  { name: "Validator #3", status: "Maintenance", uptime: "98.2%", location: "Asia-East" },
  { name: "Validator #4", status: "Online",      uptime: "99.8%", location: "US-West"   },
];

export const activeClaimsFixture = [
  {
    category:   "Climate",
    impact:     "High Impact",
    title:      "Global average temperatures increased by 1.1 degrees C since pre-industrial times",
    source:     "IPCC Report 2023",
    status:     "Verified",
    confidence: "97%",
    votes:      "8,432",
    stake:      "$45,200",
    time:       "2h ago",
    actions:    "View",
  },
  {
    category:   "Health",
    impact:     "High Impact",
    title:      "New vaccine shows 95% efficacy in Phase 3 trials",
    source:     "Nature Medicine",
    status:     "Verified",
    confidence: "94%",
    votes:      "6,721",
    stake:      "$38,600",
    time:       "9h ago",
    actions:    "View",
  },
  {
    category:   "Technology",
    impact:     "High Impact",
    title:      "Tech company achieved quantum supremacy milestone",
    source:     "Press Release",
    status:     "Under Review",
    confidence: "Pending",
    votes:      "1,243",
    stake:      "$16,800",
    time:       "2d 4h",
    actions:    "Vote",
  },
];

export const claimableRewardsFixture: ClaimableRewardFixture[] = [
  {
    claimId: "1",
    title:   "Global average temperatures increased by 1.1 degrees C since pre-industrial times",
    amount:  85.0,
  },
  {
    claimId: "2",
    title:   "New vaccine shows 95% efficacy in Phase 3 trials",
    amount:  57.5,
  },
];
