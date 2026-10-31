# Contributing to Our Cycle

Thank you for contributing to Our Cycle! We welcome contributions that maintain our high standards of mathematical rigor, code elegance, security, and privacy.

---

## 1. Development Environment Setup

This project uses modern JavaScript tooling and supports both **Bun** (recommended) and **Node.js (>= 20)** with **npm/pnpm**:

```bash
# Clone the repository
git clone git@github.com:d0132833-hash/OurCycle.git
cd OurCycle

# Install dependencies
bun install
# or: npm install

# Start the development server (runs with LocalFileStore automatically)
bun run dev
# or: npm run dev
```

Visit `http://localhost:3000` to interact with the local development instance.

---

## 2. Testing & Quality Assurance

Our Cycle maintains strict test coverage over its core prediction algorithms, cryptographic routines, and offline synchronization:

```bash
# Run all unit test suites
bun test
# or: npx vitest run

# Run TypeScript typecheck
npx tsc --noEmit

# Run ESLint validation
bun run lint
# or: npm run lint
```

> **Rule**: Any modification to `src/lib/predictions.ts` must maintain 100% test passing in `tests/predictions.test.ts`.

---

## 3. Architecture Rules

When authoring code, adhere to these fundamental principles:

1. **Prediction Engine Isolation**:
   - `src/lib/predictions.ts` must remain a **pure TypeScript module with zero I/O**.
   - No filesystem access, no fetch, no database queries, and no dependencies on global mutable state.
2. **Date Safety**:
   - All dates in the domain layer are strictly `'YYYY-MM-DD'` strings.
   - Never use JavaScript `Date` timestamps for arithmetic directly — use helper functions from `src/lib/dates.ts` (`addDays`, `diffDays`).
3. **Dual Storage Compliance**:
   - Every storage operation must be supported by both `LocalFileStore` and `SupabaseStore`.
4. **Privacy & Zero Telemetry**:
   - Never introduce third-party trackers, external font CDNs, analytics beacons, or remote logging.
   - All fonts must remain self-hosted via `next/font`.
5. **System Documentation Integrity**:
   - **After making changes, update all the system markdown files & then push everything to github.**
   - Keep `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `worklog.md`, and `CONTRIBUTING.md` current and accurate.

---

## 4. Submitting Changes & Pushing to GitHub

1. Create a feature branch (or work on main): `git checkout -b feature/your-feature-name`.
2. Commit changes with semantic commit messages (`feat:`, `fix:`, `docs:`, `perf:`).
3. **Update all system markdown files**: Ensure `worklog.md`, `CHANGELOG.md`, `README.md`, and `ARCHITECTURE.md` reflect the work done.
4. Verify that `npm test` (`npx vitest run`) and `npm run build` pass completely with zero errors.
5. Push everything to GitHub (`git push origin main` or submit a Pull Request).

