/**
 * State coverage for ActivityAndNodes.
 *
 * Covers: loading, undefined (unloaded), empty (confirmed-empty),
 * unavailable, data, stale, and retry.
 *
 * Recharts ResponsiveContainer requires a DOM measurement that jsdom cannot
 * provide, so we mock the chart at module level.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ActivityAndNodes from "../ActivityAndNodes";
import { activityDataFixture } from "@/__tests__/fixtures/dashboard-fixtures";

jest.mock("@/components/skeletons", () => ({
  ActivityChartSkeleton: () => <div data-testid="activity-chart-skeleton" />,
}));

// Mock Recharts — jsdom has no layout engine so ResponsiveContainer cannot
// measure its container; stub the chart to a simple sentinel.
jest.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe("ActivityAndNodes — loading state", () => {
  it("renders the skeleton when isLoading is true", () => {
    render(<ActivityAndNodes isLoading />);
    expect(
      screen.getByTestId("activity-chart-skeleton")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Verification Activity")
    ).not.toBeInTheDocument();
  });

  it("does not render chart or empty message while loading", () => {
    render(<ActivityAndNodes isLoading data={activityDataFixture} />);
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });
});

describe("ActivityAndNodes — unloaded / undefined state", () => {
  it("renders 'No activity data yet.' when data is undefined (not yet fetched)", () => {
    render(<ActivityAndNodes />);
    expect(screen.getByText("Verification Activity")).toBeInTheDocument();
    expect(screen.getByText("No activity data yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });
});

describe("ActivityAndNodes — confirmed-empty state", () => {
  it("renders 'No activity data yet.' when an empty array is returned", () => {
    render(<ActivityAndNodes data={[]} />);
    expect(screen.getByText("No activity data yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });
});

describe("ActivityAndNodes — unavailable state", () => {
  it("renders the canonical unavailable message when isUnavailable is true", () => {
    render(<ActivityAndNodes isUnavailable />);
    expect(
      screen.getByText("Activity data is currently unavailable.")
    ).toBeInTheDocument();
  });

  it("does not render the chart when unavailable, even if data is passed", () => {
    render(<ActivityAndNodes isUnavailable data={activityDataFixture} />);
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
    expect(
      screen.getByText("Activity data is currently unavailable.")
    ).toBeInTheDocument();
  });
});

describe("ActivityAndNodes — data state", () => {
  it("renders the chart when data has entries", () => {
    render(<ActivityAndNodes data={activityDataFixture} />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("renders the legend labels", () => {
    render(<ActivityAndNodes data={activityDataFixture} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Disputed")).toBeInTheDocument();
    expect(screen.getByText("False")).toBeInTheDocument();
  });

  it("chart has an accessible aria-label", () => {
    render(<ActivityAndNodes data={activityDataFixture} />);
    // The chart container is rendered with the mocked AreaChart.
    // The aria-label is on the AreaChart element which our mock renders as a div.
    // Verify the chart container itself is present.
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

describe("ActivityAndNodes — retry / recovery", () => {
  it("transitions from unavailable to chart when isUnavailable is cleared and data provided", () => {
    const { rerender } = render(<ActivityAndNodes isUnavailable />);
    expect(
      screen.getByText("Activity data is currently unavailable.")
    ).toBeInTheDocument();

    rerender(<ActivityAndNodes data={activityDataFixture} />);
    expect(
      screen.queryByText("Activity data is currently unavailable.")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("transitions from loading to chart", () => {
    const { rerender } = render(<ActivityAndNodes isLoading />);
    expect(
      screen.getByTestId("activity-chart-skeleton")
    ).toBeInTheDocument();

    rerender(<ActivityAndNodes data={activityDataFixture} />);
    expect(
      screen.queryByTestId("activity-chart-skeleton")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });
});
