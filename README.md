# Literal

Digital circuits in your browser.

A browser-native logic circuit editor and simulator, inspired by Logisim. TypeScript, no execution server. The interface follows ISETL Web’s compact Pond design: a large workspace, quiet sage colors, rounded controls, and logos that respond on hover.

## Status

Initial scaffold. The reusable simulation core and an interactive half-adder demo are implemented. The circuit drawing editor is next; this is not yet a replacement for Logisim.

## Development

Node.js 22.12 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
```

## Structure

- `packages/core/`: UI-independent logic evaluation, circuit validation, connections, flip-flop state, and truth tables.
- `apps/web/`: browser frontend and SVG assets.
- `tests/`: simulation and document validation tests.

## Next

- Place and move gates on a grid; connect pins with wires.
- Inspect signals, toggle inputs, and step clocks.
- Undo/redo, local autosave, and circuit import/export.
- Truth table view and runnable example circuits.
- Keyboard operation and reduced-motion support.

The core uses single-bit `0`, `1`, and unknown `X` signals. D flip-flops sample on a known rising edge. Combinational feedback produces a diagnostic; asynchronous latch simulation, buses, subcircuits, and Logisim file compatibility are outside the initial scope.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Original code is MIT licensed. Logisim is an inspiration; no Logisim source is included.
