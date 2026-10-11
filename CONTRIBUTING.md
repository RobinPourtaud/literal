# Contributing

Run `npm ci`, then `npm run dev`. Before submitting changes, run `npm test` and `npm run build`.

Keep simulation and circuit document handling in `packages/core`, independent of browser APIs. UI code belongs in `apps/web`. Add tests for changes to circuit semantics or validation. Include screenshots and browser checks for interface changes.

Open an issue before larger architectural changes. Small bug reports, examples, accessibility improvements, and documentation fixes are welcome.
