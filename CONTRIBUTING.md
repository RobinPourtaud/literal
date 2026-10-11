# Contributing

Use Deno 2. Run `deno task dev` to start the editor. Before submitting changes,
run:

```sh
deno task fmt-check
deno task test
deno task build
```

Keep simulation and document handling in `packages/core`, independent of browser
APIs. UI code belongs in `apps/web`. Add tests when circuit semantics or
validation change. For interface changes, check placing, wiring, moving,
keyboard operation, and file handling in a browser, and include a screenshot
when useful.

`deno task browser-check` runs interaction checks through Orca. See the README
for setup; it modifies the circuit in the local preview. CI runs the portable
Deno tests and production build.

Circuit files are versioned. Preserve existing documents or provide an explicit
migration if the format changes. Inputs use one driver and outputs may fan out.
Unknown signals and sequential state should remain consistent between the UI and
the reusable core.

Bug reports should include the circuit file, browser, reproduction steps, and
expected signals. Examples, accessibility improvements, documentation fixes, and
simulator tests are welcome. Discuss larger architectural changes before
implementation.
