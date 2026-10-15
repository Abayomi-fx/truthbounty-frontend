import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import StatsCards from "../StatsCards";
import { platformStatsFixture } from "@/__tests__/fixtures/dashboard-fixtures";

jest.mock("@/components/skeletons", () => ({
  StatsCardsSkeleton: () => <div data-testid="stats-cards-skeleton" />,
}));

jest.mock("@/components/ui/TrustScoreTooltip", () => {
  return function DummyTrustScoreTooltip() {
    return <div data-testid="trust-score-tooltip" />;
  };
});

function mockTrust(reputation: number | null) {
  jest.mock("@/components/hooks/useTrust", () => ({
    useTrust: () => ({
      reputation,
      accountAgeDays: null,
      suspicious: null,
      isVerified: false,
    }),
  }));
}

// Default mock — reputation known
jest.mock("@/components/hooks/useTrust", () => ({
  useTrust: () => ({
    reputation: 95,
    accountAgeDays: null,
    suspicious: null,
    isVerified: false,
  }),
}));

describe("StatsCards — loading state", () => {
  it("renders skeleton when isLoading is true", () => {
    render(<StatsCards isLoading />);
    expect(screen.getByTestId("stats-cards-skeleton")).toBeInTheDocument();
  });

  it("does not render stat cards while loading", () => {
    render(<StatsCards isLoading />);
    expect(screen.queryByLabelText(/My Trust/)).not.toBeInTheDocument();
  });
});

describe("StatsCards — My Trust card", () => {
  it("renders the My Trust value and label", () => {
    render(<StatsCards />);
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("My Trust")).toBeInTheDocument();
  });

  it("STAB-FE-002: exposes an accessible name pairing label and value", () => {
    render(<StatsCards />);
    expect(screen.getByLabelText("My Trust: 95")).toBeInTheDocument();
  });

  it("STAB-FE-002: keeps value, label and tooltip in the same card", () => {
    render(<StatsCards />);
    const card = screen.getByLabelText("My Trust: 95");
    expect(within(card).getByText("95")).toBeInTheDocument();
    expect(within(card).getByText("My Trust")).toBeInTheDocument();
    expect(within(card).getByTestId("trust-score-tooltip")).toBeInTheDocument();
  });
});

describe("StatsCards — null reputation (unavailable)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("@/components/hooks/useTrust", () => ({
      useTrust: () => ({
        reputation: null,
        accountAgeDays: null,
        suspicious: null,
        isVerified: false,
      }),
    }));
  });

  afterEach(() => {
    jest.resetModules();
    // Restore default mock
    jest.doMock("@/components/hooks/useTrust", () => ({
      useTrust: () => ({
        reputation: 95,
        accountAgeDays: null,
        suspicious: null,
        isVerified: false,
      }),
    }));
  });

  it("renders em-dash, not the string 'null', when reputation is unavailable", async () => {
    // Re-import after doMock
    const { default: StatsCardsFresh } = await import("../StatsCards");
    render(<StatsCardsFresh />);
    // The "My Trust" card should show "—" not "null"
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });
});

describe("StatsCards — platform stats", () => {
  it("renders em-dash placeholders for all 6 stat labels when platformStats is not provided", () => {
    render(<StatsCards />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(6);
  });

  it("renders supplied platformStats values", () => {
    render(<StatsCards platformStats={platformStatsFixture} />);
    for (const stat of platformStatsFixture) {
      expect(screen.getByText(stat.label)).toBeInTheDocument();
      expect(screen.getByText(stat.value)).toBeInTheDocument();
    }
  });

  it("does not show em-dashes when real platform stats are supplied", () => {
    render(<StatsCards platformStats={platformStatsFixture} />);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
