import {
  ClaimData,
  Evidence,
  TimelineEvent,
  TopVerifier,
} from "@/app/types/dispute";

export const claimData: ClaimData = {
  id: "1",
  category: "Climate",
  hash: "0x1a2b ... 3c4d",
  status: "Verified",
  title:
    "Global average temperatures increased by 1.1°C since pre-industrial times",
  source: "IPCC Report 2023",
  timeAgo: "2h ago",
  votesFor: 8432,
  votesAgainst: 234,
  verifiersCount: 847,
  confidenceScore: 97,
  totalStaked: 45200,
};

export const evidences: Evidence[] = [
  {
    id: "1",
    title: "IPCC AR6 Synthesis Report",
    description: "Primary Source",
    url: "#",
  },
  {
    id: "2",
    title: "NASA Climate Data",
    description: "Supporting Data",
    url: "#",
  },
  {
    id: "3",
    title: "Peer Review Analysis",
    description: "Verification",
    url: "#",
  },
];

export const timelineEvents: TimelineEvent[] = [
  {
    id: "1",
    title: "Claim Submitted",
    timeAgo: "2 days ago",
    actor: "0x7a8b...9c0d",
    isRecent: false,
  },
  {
    id: "2",
    title: "First Verification",
    timeAgo: "1 day ago",
    actor: "Academic Consortium",
    isRecent: false,
  },
  {
    id: "3",
    title: "Stake Threshold Reached",
    timeAgo: "18 hours ago",
    actor: "System",
    isRecent: false,
  },
  {
    id: "4",
    title: "Community Voting Started",
    timeAgo: "12 hours ago",
    actor: "System",
    isRecent: true,
  },
];

export const topVerifiers: TopVerifier[] = [
  {
    id: "1",
    rank: 1,
    name: "Academic Consortium",
    staked: "$12,400",
    score: 98.2,
  },
  { id: "2", rank: 2, name: "News Alliance", staked: "$8,200", score: 96.8 },
  {
    id: "3",
    rank: 3,
    name: "Data Science Labs",
    staked: "$6,100",
    score: 97.5,
  },
];
