// NEGATIVE fixtures — token-drift violations for test assertions.
// Each export demonstrates one specific forbidden pattern.
// These must produce ≥ 1 violation each when scanned by check-token-drift.mjs.
//
// NOTE: This file is intentionally in __tests__/fixtures/, NOT in
// src/components/, so it does NOT trigger the real CI gate.

// 1. Raw hex colour in className
export function HexColorBadge() {
  return (
    // violation: raw hex in className
    <span className="bg-[#ff0000] text-white rounded-md px-2 py-1">
      Hex badge
    </span>
  );
}

// 2. Inline rgb() colour
export function RgbColorCard() {
  return (
    // violation: rgb() call
    <div style={{ backgroundColor: 'rgb(255, 99, 71)' }}>Card</div>
  );
}

// 3. Inline hsl() colour
export function HslColorSpan() {
  return (
    // violation: hsl() call
    <span style={{ color: 'hsl(120, 100%, 50%)' }}>Green text</span>
  );
}

// 4. oklch() inside a className string (should go through token)
export function OklchClassName() {
  return (
    // violation: oklch in className
    <div className="text-[oklch(0.5 0.2 264)]">OKLCH inline</div>
  );
}

// 5. Inline px margin
export function InlinePxMargin() {
  return (
    // violation: inline px margin
    <div style={{ margin: '16px' }}>Margin div</div>
  );
}

// 6. Arbitrary px border-radius
export function ArbitraryRadius() {
  return (
    // violation: arbitrary px radius
    <div className="rounded-[12px] bg-surface">Arbitrary radius</div>
  );
}

// 7. Duplicate primitive — data-slot matches a canonical primitive outside primitives/
export function DuplicateCardImpl({ children }: { children: React.ReactNode }) {
  return (
    // violation: duplicate implementation of "card" primitive
    <div data-slot="card" className="rounded-xl border border-divider bg-surface">
      {children}
    </div>
  );
}
