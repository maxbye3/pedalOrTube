# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Testing

- Unit tests run on [Vitest](https://vitest.dev): `npm test` (`vitest run`). Place specs next to the code as `*.test.ts` under `src/`.
- The `@/` path alias is mapped to `./src` in `vitest.config.ts` (mirroring `tsconfig.json`).
- Service tests that would otherwise hit OTP/network stub the dependency with `vi.mock` (see `src/services/JourneyCalculator.test.ts`, which mocks `RoutingService.fetchCandidates`).

## Known sharp edges

- `npm run lint` (`next lint`) currently crashes with a "Converting circular structure to JSON" error from `eslint-config-next` 16 loaded via the legacy `FlatCompat.extends(...)` pattern in `eslint.config.mjs`. The fix is to spread the flat configs directly (`import nextCoreWebVitals from "eslint-config-next/core-web-vitals"` etc.), but doing so surfaces pre-existing violations across the codebase (e.g. `react-hooks/set-state-in-effect` in `WeatherWidget.tsx`, unused imports). Lint is therefore not yet wired into CI.
