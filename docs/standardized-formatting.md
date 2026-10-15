# Standardized Time, Number, and Token Formatting (V2-FE-127)

## Overview
This specification documents the canonical formatting infrastructure in TruthBounty Protocol V2 (`src/lib/format.ts` and `src/components/ui/formatting/`). The formatting system standardizes time, numbers, currencies, durations, addresses, and EVM token amounts across all frontend surfaces, ensuring strict accessibility (WCAG AA), localization, zero-outcome fabrication, and high precision.

---

## Key Principles & Architectural Guarantees

1. **Precision & Safety (Optimism / EVM 18 Decimals)**
   - Never converts raw `BigInt` wei to JavaScript floating-point numbers without scaling, preventing IEEE-754 precision loss on large quantities.
   - Built on `viem`'s `formatUnits` and `parseUnits`.
   - Never fabricates outcomes or balances: missing, null, or corrupted data fails closed to explicit, non-misleading fallbacks (`—` or `0`).
   - Detects tiny positive amounts below visual thresholds (`< 0.01` or `< 0.0001`) instead of displaying a false `0`.

2. **Accessibility & Semantic HTML**
   - Renders timestamps and durations with native HTML5 `<time dateTime="...">` tags.
   - Screen-reader friendly announcements with `aria-label` detailing full, unabbreviated values and token symbols (e.g. `aria-label="45,200 TBNT tokens"`).
   - Numeric and financial displays enforce `font-mono tabular-nums` to eliminate layout jitter and horizontal shift during real-time updates.

3. **Deterministic Localization**
   - Leverages `Intl.NumberFormat` and `Intl.DateTimeFormat` with configurable locale preferences and deterministic defaults (`en-US`).
   - Standardized countdowns and durations (`2d 4h`, `2h 15m`, `10m`, `45s`, `Expired`).

---

## Canonical Formatting Functions (`@/lib/format`)

### Token Formatting
```typescript
import { formatTokenAmount, formatEther, formatBondAmount } from '@/lib/format';

// EVM raw base units (wei / BigInt)
formatTokenAmount(1000000000000000000n, { symbol: 'TBNT' }); // "1 TBNT"

// Scaled decimal numbers
formatTokenAmount(1234.567, { displayDecimals: 2, symbol: 'TBNT' }); // "1,234.57 TBNT"

// Compact large quantities
formatTokenAmount(1500000, { compact: true, symbol: 'TBNT' }); // "1.5M TBNT"

// Challenge & dispute bonds (in 4-decimal ETH)
formatBondAmount('1000000000000000000'); // "1.0000"
```

### Numbers, Currency & Percentages
```typescript
import { formatNumber, formatCurrency, formatPercent } from '@/lib/format';

formatNumber(847291); // "847,291"
formatNumber(1200000, { compact: true }); // "1.2M"

formatCurrency(45200); // "$45,200"
formatCurrency(2400000, { compact: true }); // "$2.4M"

formatPercent(97); // "97%"
formatPercent(0.95, { isFraction: true }); // "95%"
```

### Time, Date, and Countdown Durations
```typescript
import { formatDate, formatDateTime, formatTimeAgo, formatDuration, getDisputeTimeRemaining } from '@/lib/format';

formatDate('2026-01-25T14:32:00Z'); // "Jan 25, 2026"
formatDateTime('2026-01-25T14:32:00Z'); // "Jan 25, 2026 • 14:32"
formatTimeAgo(date); // "2h ago", "1 day ago", "just now"

formatDuration(7260); // "2h 1m"
getDisputeTimeRemaining({ timeRemaining: 600 }); // "10m"
getDisputeTimeRemaining({ timeRemaining: 0 }); // "Expired"
```

### Address & Hash Truncation
```typescript
import { formatAddress, formatTxHash } from '@/lib/format';

formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E'); // "0x742d...eB1E"
formatTxHash('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'); // "0x1234...cdef"
```

---

## Accessible React Primitives (`@/components/ui/formatting`)

| Component | Purpose | Key Attributes |
|---|---|---|
| `<FormattedToken />` | Formats tokens with symbol and tabular layout | `aria-label`, `tabular-nums`, title tooltip for compact view |
| `<FormattedNumber />` | Formats numbers, currencies, and percentages | `tabular-nums`, locale formatting |
| `<FormattedTime />` | Renders dates and times | HTML5 `<time dateTime="...">`, full date tooltip |
| `<FormattedDuration />` | Renders countdowns & durations | HTML5 `<time dateTime="PT...S">`, expired status |
| `<FormattedAddress />` | Renders copyable EVM address | Monospace, copy button, screen reader feedback |

### Usage Example
```tsx
import { FormattedToken, FormattedTime } from '@/components/ui/formatting';

<FormattedToken amount={claim.stakedAmount} symbol="TBNT" />
<FormattedTime date={claim.createdAt} mode="relative" />
```
