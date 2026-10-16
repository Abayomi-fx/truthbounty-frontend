import {
  formatTokenAmount,
  formatEther,
  formatBondAmount,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatDateTime,
  formatTime,
  formatTimeAgo,
  formatDuration,
  getDisputeTimeRemaining,
  formatAddress,
  formatTxHash,
  formatStatus,
  toValidDate,
} from "../format";

describe("Standardized Formatting Module (@/lib/format)", () => {
  // ==========================================================================
  // Token Formatting Tests
  // ==========================================================================
  describe("formatTokenAmount", () => {
    it("handles legacy signature formatTokenAmount(amount, decimals)", () => {
      expect(formatTokenAmount(1234.567, 2)).toBe("1,234.57");
      expect(formatTokenAmount("1234.567", 2)).toBe("1,234.57");
      expect(formatTokenAmount(undefined, 2)).toBe("0");
      expect(formatTokenAmount(null, 2)).toBe("0");
    });

    it("formats raw base units (wei / BigInt) safely using EVM 18 decimals", () => {
      // 1 ETH / 1 TBNT in wei
      const oneTokenWei = 1_000_000_000_000_000_000n;
      expect(formatTokenAmount(oneTokenWei, { symbol: "TBNT" })).toBe("1 TBNT");

      // 45,200 TBNT
      const fortyFiveKWei = 45_200n * 1_000_000_000_000_000_000n;
      expect(formatTokenAmount(fortyFiveKWei, { symbol: "TBNT" })).toBe("45,200 TBNT");
    });

    it("formats custom decimals like USDC (6 decimals)", () => {
      // 50 USDC = 50_000_000 base units
      const usdcWei = 50_000_000n;
      expect(
        formatTokenAmount(usdcWei, { decimals: 6, displayDecimals: 2, symbol: "USDC" })
      ).toBe("50 USDC");
    });

    it("handles compact notation for large amounts", () => {
      expect(formatTokenAmount(1_500_000, { compact: true, symbol: "TBNT" })).toBe(
        "1.5M TBNT"
      );
    });

    it("handles tiny non-zero values below display threshold without rounding to false zero", () => {
      // 0.00001 with 2 display decimals
      expect(formatTokenAmount(0.00001, { displayDecimals: 2 })).toBe("< 0.01");
      expect(formatTokenAmount(0.000005, { displayDecimals: 4 })).toBe("< 0.0001");
    });

    it("fails closed on invalid, NaN, or corrupted values", () => {
      expect(formatTokenAmount(NaN)).toBe("0");
      expect(formatTokenAmount("invalid_amount")).toBe("0");
      expect(formatTokenAmount(null, { fallback: "—" })).toBe("—");
    });
  });

  describe("formatEther & formatBondAmount", () => {
    it("formats 1 ETH correctly", () => {
      expect(formatBondAmount("1000000000000000000")).toBe("1.0000");
      expect(formatEther("1000000000000000000")).toBe("1.0000");
    });

    it("formats 0.5 ETH correctly", () => {
      expect(formatBondAmount("500000000000000000")).toBe("0.5000");
    });

    it("formats 0.1234 ETH correctly", () => {
      expect(formatBondAmount("123400000000000000")).toBe("0.1234");
    });

    it("handles invalid and zero bond amount strings gracefully", () => {
      expect(formatBondAmount("invalid")).toBe("0.0000");
      expect(formatBondAmount("0")).toBe("0.0000");
      expect(formatBondAmount(null)).toBe("0.0000");
      expect(formatBondAmount(undefined)).toBe("0.0000");
    });

    it("supports BigInt wei values directly", () => {
      expect(formatBondAmount(1_000_000_000_000_000_000n)).toBe("1.0000");
    });
  });

  // ==========================================================================
  // Number & Currency Formatting Tests
  // ==========================================================================
  describe("formatNumber", () => {
    it("formats standard integers with thousand separators", () => {
      expect(formatNumber(12847)).toBe("12,847");
      expect(formatNumber(847291)).toBe("847,291");
    });

    it("formats decimal numbers with min/max decimal control", () => {
      expect(formatNumber(12.3456, { minDecimals: 2, maxDecimals: 2 })).toBe("12.35");
      expect(formatNumber(12, { minDecimals: 2 })).toBe("12.00");
    });

    it("formats compact notation", () => {
      expect(formatNumber(1_200_000, { compact: true })).toBe("1.2M");
      expect(formatNumber(45_200, { compact: true })).toBe("45.2K");
    });

    it("handles fallbacks on invalid inputs", () => {
      expect(formatNumber(null)).toBe("0");
      expect(formatNumber(undefined)).toBe("0");
      expect(formatNumber(NaN, { fallback: "—" })).toBe("—");
    });
  });

  describe("formatCurrency", () => {
    it("formats USD currency values properly", () => {
      expect(formatCurrency(45200)).toBe("$45,200");
      expect(formatCurrency(12.5)).toBe("$12.50");
      expect(formatCurrency(0)).toBe("$0");
    });

    it("formats compact currency", () => {
      expect(formatCurrency(2_400_000, { compact: true })).toBe("$2.4M");
    });

    it("handles null/undefined gracefully", () => {
      expect(formatCurrency(null)).toBe("$0");
      expect(formatCurrency(undefined, { fallback: "—" })).toBe("—");
    });
  });

  describe("formatPercent", () => {
    it("formats integer percentages", () => {
      expect(formatPercent(97)).toBe("97%");
      expect(formatPercent(100)).toBe("100%");
      expect(formatPercent(0)).toBe("0%");
    });

    it("formats decimals when requested", () => {
      expect(formatPercent(98.2, { decimals: 1 })).toBe("98.2%");
    });

    it("handles fractional inputs (e.g. 0.95 -> 95%)", () => {
      expect(formatPercent(0.95, { isFraction: true })).toBe("95%");
      expect(formatPercent(0.985, { isFraction: true, decimals: 1 })).toBe("98.5%");
    });

    it("clamps values between 0 and 100 by default", () => {
      expect(formatPercent(150)).toBe("100%");
      expect(formatPercent(-10)).toBe("0%");
    });

    it("handles null and undefined", () => {
      expect(formatPercent(null)).toBe("0%");
      expect(formatPercent(undefined, { fallback: "—" })).toBe("—");
    });
  });

  // ==========================================================================
  // Time & Date Formatting Tests
  // ==========================================================================
  describe("toValidDate", () => {
    it("parses Date object", () => {
      const d = new Date(2026, 0, 15);
      expect(toValidDate(d)?.getTime()).toBe(d.getTime());
    });

    it("parses ISO string", () => {
      const parsed = toValidDate("2026-01-15T12:00:00.000Z");
      expect(parsed).not.toBeNull();
      expect(parsed?.toISOString()).toBe("2026-01-15T12:00:00.000Z");
    });

    it("parses EVM Unix timestamp in seconds", () => {
      // 1768478400 = Jan 15 2026
      const seconds = 1768478400;
      const parsed = toValidDate(seconds);
      expect(parsed?.getTime()).toBe(seconds * 1000);
    });

    it("returns null on invalid inputs", () => {
      expect(toValidDate(null)).toBeNull();
      expect(toValidDate(undefined)).toBeNull();
      expect(toValidDate("not-a-date")).toBeNull();
      expect(toValidDate(NaN)).toBeNull();
    });
  });

  describe("formatDate & formatDateTime", () => {
    const testDate = new Date("2026-01-25T14:32:00Z");

    it("formats readable date with medium default", () => {
      const result = formatDate(testDate, { timeZone: "UTC" });
      expect(result).toContain("Jan 25, 2026");
    });

    it("formats short and long formats", () => {
      expect(formatDate(testDate, { format: "short", timeZone: "UTC" })).toContain("26");
      expect(formatDate(testDate, { format: "long", timeZone: "UTC" })).toContain("January");
    });

    it("formats date + time with bullet separator", () => {
      const result = formatDateTime(testDate, { timeZone: "UTC" });
      expect(result).toContain("Jan 25, 2026");
      expect(result).toContain("•");
      expect(result).toContain("14:32");
    });

    it("handles null/undefined gracefully", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDateTime(undefined)).toBe("—");
    });
  });

  describe("formatTimeAgo", () => {
    const now = new Date("2026-01-25T12:00:00Z").getTime();

    it("returns 'just now' for very recent events", () => {
      const recent = new Date(now - 5000);
      expect(formatTimeAgo(recent, { relativeTo: now })).toBe("just now");
    });

    it("formats minutes ago", () => {
      const fiveMinAgo = new Date(now - 5 * 60 * 1000);
      expect(formatTimeAgo(fiveMinAgo, { relativeTo: now })).toBe("5m ago");
      expect(formatTimeAgo(fiveMinAgo, { relativeTo: now, short: false })).toBe(
        "5 minutes ago"
      );
    });

    it("formats hours ago", () => {
      const twoHoursAgo = new Date(now - 2 * 3600 * 1000);
      expect(formatTimeAgo(twoHoursAgo, { relativeTo: now })).toBe("2h ago");
      expect(formatTimeAgo(twoHoursAgo, { relativeTo: now, short: false })).toBe(
        "2 hours ago"
      );
    });

    it("formats days ago", () => {
      const oneDayAgo = new Date(now - 24 * 3600 * 1000);
      expect(formatTimeAgo(oneDayAgo, { relativeTo: now })).toBe("1 day ago");

      const twoDaysAgo = new Date(now - 48 * 3600 * 1000);
      expect(formatTimeAgo(twoDaysAgo, { relativeTo: now })).toBe("2 days ago");
    });

    it("handles future dates gracefully", () => {
      const future = new Date(now + 120 * 1000);
      expect(formatTimeAgo(future, { relativeTo: now })).toBe("in 2m");
    });

    it("handles invalid dates with fallback", () => {
      expect(formatTimeAgo(null)).toBe("—");
    });
  });

  describe("formatDuration & getDisputeTimeRemaining", () => {
    it("formats hours and minutes countdown", () => {
      // 2h 1m = 7260s
      expect(formatDuration(7260)).toBe("2h 1m");
      expect(getDisputeTimeRemaining({ timeRemaining: 7260 })).toBe("2h 1m");
    });

    it("formats minutes only when less than 1 hour", () => {
      // 10m = 600s
      expect(formatDuration(600)).toBe("10m");
      expect(getDisputeTimeRemaining({ timeRemaining: 600 })).toBe("10m");
    });

    it("formats seconds when under 1 minute", () => {
      expect(formatDuration(45)).toBe("45s");
    });

    it("formats days and hours", () => {
      // 2d 4h = 2 * 86400 + 4 * 3600 = 187200s
      expect(formatDuration(187200)).toBe("2d 4h");
    });

    it("returns 'Expired' for zero or negative durations", () => {
      expect(formatDuration(0)).toBe("Expired");
      expect(formatDuration(-10)).toBe("Expired");
      expect(getDisputeTimeRemaining({ timeRemaining: 0 })).toBe("Expired");
      expect(getDisputeTimeRemaining({ timeRemaining: -100 })).toBe("Expired");
      expect(getDisputeTimeRemaining(null)).toBe("Expired");
      expect(getDisputeTimeRemaining(undefined)).toBe("Expired");
    });
  });

  // ==========================================================================
  // Address & Hash Formatting Tests
  // ==========================================================================
  describe("formatAddress & formatTxHash", () => {
    const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E";

    it("truncates address with default 4 chars (0x1234...5678)", () => {
      expect(formatAddress(address)).toBe("0x742d...eB1E");
    });

    it("supports custom chars and delimiter", () => {
      expect(formatAddress(address, 6)).toBe("0x742d35...f0eB1E");
      expect(formatAddress(address, { prefixChars: 6, suffixChars: 4, delimiter: "…" })).toBe(
        "0x742d…eB1E"
      );
    });

    it("handles short inputs and null/undefined safely", () => {
      expect(formatAddress("0x123")).toBe("0x123");
      expect(formatAddress(null)).toBe("—");
      expect(formatAddress(undefined)).toBe("—");
    });

    it("truncates tx hash properly", () => {
      const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(formatTxHash(hash)).toBe("0x1234...cdef");
      expect(formatTxHash(null)).toBe("—");
    });
  });

  // ==========================================================================
  // Status Formatting Tests
  // ==========================================================================
  describe("formatStatus", () => {
    it("converts uppercase/snake_case to title case", () => {
      expect(formatStatus("UNDER_REVIEW")).toBe("Under Review");
      expect(formatStatus("VERIFIED")).toBe("Verified");
      expect(formatStatus("DISPUTED")).toBe("Disputed");
    });

    it("handles null or undefined status", () => {
      expect(formatStatus(undefined)).toBe("Unknown");
      expect(formatStatus("")).toBe("Unknown");
    });
  });
});
