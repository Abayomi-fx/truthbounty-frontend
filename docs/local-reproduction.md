# Local Reproduction & CI Validation Guide (V2-FE-042)

This document describes how to execute and verify the required quality and build gates locally.

---

## 🛠️ Required Quality Gates

All checks must pass before merging code into `main`.

### 1. Lint & Code Style
Run ESLint over all source files:
```bash
npm run lint
# or
pnpm lint
```

### 2. Unit & Integration Tests
Run the Jest test suite:
```bash
npm run test
# or
pnpm test
```

### 3. Accessibility Tests (WCAG 2.1 AA / axe-core)
Run all automated axe accessibility test suites:
```bash
npm run test:a11y
# or
pnpm test:a11y
```

### 4. Release Artifacts Verification
Verify contract deployment manifests, chain IDs, and cryptographic checksums:
```bash
npm run verify-artifacts
# or
pnpm verify-artifacts
```

### 5. Type Checking
Ensure TypeScript strict type safety:
```bash
npm run type-check
# or
pnpm type-check
```

### 6. Production Build
Ensure Next.js production build succeeds without runtime or configuration errors:
```bash
npm run build
# or
pnpm build
```

---

## 🔒 Security & Least Privilege

* **Workflow Permissions:** The GitHub Actions workflow enforces `permissions: contents: read` to prevent privilege escalation on pull requests.
* **Non-Skippable Gates:** All permissive flags (`continue-on-error`, `|| echo ...`, `if: always()`) have been removed to guarantee failure enforcement.
* **Environment Isolation:** No secrets or production credentials are hardcoded.
