# Dependency security review

Reviewed on 2026-10-13 against the current main branch.

## Version alignment

- Next.js and eslint-config-next: 16.3.8.
- React, React DOM and react-server-dom-webpack: 19.2.8.
- @vitejs/plugin-react: 6.0.4; @vitejs/plugin-rsc: 0.5.32.
- Tailwind CSS and @tailwindcss/postcss: 4.3.3.
- TypeScript 5.9.3, vinext 0.0.50 and Vite 8.0.16 remain pinned.

Sharp and Undici overrides were advanced to their security patch releases.
Additional overrides target only vulnerable locked transitive versions so that
future upstream dependency updates can move beyond these pins.

## Outstanding upstream advisory

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects braces 3.0.3 and has no published patched version at review time.
It is brought in by two build-tool chains:

- eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch.
- vinext -> vite-plugin-commonjs -> vite-plugin-dynamic-import -> fast-glob -> micromatch.

These paths process repository glob patterns during linting and bundling.
Do not pass untrusted input to these build tools. The package is excluded from
the production dependency installation. This limits exposure but does not fix
the upstream vulnerability, and the full audit will continue reporting it.

Production dependency auditing remains a blocking CI check. A separate,
non-blocking full audit makes build-tool advisories visible in every PR run;
it does not suppress this advisory or ignore registry failures.

When a compatible fix becomes available, update braces through its parents or
a narrowly scoped override, rerun both audits, and make the full audit blocking.

## Minimum validation

Use the CI runtime: Node 22.21.1 and pnpm 11.9.0.

1. pnpm install --frozen-lockfile
2. pnpm lint and pnpm typecheck
3. pnpm test, including TEST_MYSQL_URI against a disposable MySQL database
4. pnpm build
5. pnpm audit --prod --audit-level high and pnpm audit --audit-level high
6. Run the Docker build and container health/login/shared API checks in CI.
7. Check browser hydration, desktop/mobile layout, local UI interactions and HMR.

GitHub dependency update workflow success does not establish compatibility;
use the Production checks workflow on the final dependency commit.
