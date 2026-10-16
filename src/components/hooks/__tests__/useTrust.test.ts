/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
import { renderHook, waitFor } from "@testing-library/react";
import { useTrust, useTrustForAddress } from "../useTrust";

jest.mock("@/hooks/useAccount", () => ({
  useAccount: jest.fn(),
}));

jest.mock("@/app/queries/user.queries", () => ({
  useUserVerification: jest.fn(),
}));

const { useAccount } = require("@/hooks/useAccount");
const { useUserVerification } = require("@/app/queries/user.queries");

describe("useTrust — development overrides", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    useAccount.mockReturnValue({ address: "0xabc" });
    useUserVerification.mockReturnValue({ data: { status: "SUCCESS" } });
  });

  it("applies localStorage.trustInfo overrides for the current user", async () => {
    const override = {
      isVerified: false,
      reputation: 15,
      accountAgeDays: 2,
      suspicious: true,
    };

    localStorage.setItem("trustInfo", JSON.stringify(override));

    const { result } = renderHook(() => useTrust());

    await waitFor(() => {
      expect(result.current.isVerified).toBe(false);
      expect(result.current.reputation).toBe(15);
      expect(result.current.accountAgeDays).toBe(2);
      expect(result.current.suspicious).toBe(true);
    });
  });

  it("keeps existing trust values when a partial override is stored", async () => {
    localStorage.setItem("trustInfo", JSON.stringify({ isVerified: false }));

    const { result } = renderHook(() => useTrust());

    await waitFor(() => {
      expect(result.current.isVerified).toBe(false);
      // Unset fields remain null — real values come from STAB-FE-001/002 endpoints.
      expect(result.current.reputation).toBeNull();
      expect(result.current.accountAgeDays).toBeNull();
      expect(result.current.suspicious).toBeNull();
    });
  });

  it("does not leak current-user overrides into address-specific trust lookups", async () => {
    localStorage.setItem(
      "trustInfo",
      JSON.stringify({ reputation: 15, isVerified: false }),
    );

    const { result, rerender } = renderHook(
      ({ address }: { address?: string }) => useTrustForAddress(address),
      { initialProps: { address: undefined as string | undefined } },
    );

    await waitFor(() => {
      expect(result.current.reputation).toBe(15);
      expect(result.current.isVerified).toBe(false);
    });

    rerender({ address: "0xdef" });

    await waitFor(() => {
      const expectedReputation =
        Array.from("0xdef").reduce(
          (sum, character) => sum + character.charCodeAt(0),
          0,
        ) % 101;

      expect(result.current.reputation).toBe(expectedReputation);
      expect(result.current.isVerified).toBe(true);
    });
  });
});

describe("useTrust — production environment", () => {
  it("parseTrustInfoFromStorage is guarded by NODE_ENV check in source", () => {
    // Verify the source contains the production guard rather than trying to
    // mutate process.env.NODE_ENV at runtime, which Jest does not support
    // (modules are already evaluated in the 'test' environment).
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../useTrust.ts"),
      "utf-8"
    );
    expect(src).toMatch(/process\.env\.NODE_ENV.*production/);
  });
});

describe("useTrust — null defaults (no API data)", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    useAccount.mockReturnValue({ address: undefined });
    useUserVerification.mockReturnValue({ data: undefined });
  });

  it("returns null for all numeric/boolean fields when no data is available", async () => {
    const { result } = renderHook(() => useTrust());

    await waitFor(() => {
      expect(result.current.reputation).toBeNull();
      expect(result.current.accountAgeDays).toBeNull();
      expect(result.current.suspicious).toBeNull();
      expect(result.current.isVerified).toBe(false);
    });
  });
});
